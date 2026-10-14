package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"html"
	"log"
	"net/url"
	"strings"
	"time"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/mailer"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

const passwordResetTTL = time.Hour

// ErrResetUnavailable aparece quando a loja ainda nao configurou o SMTP: sem
// isso nao ha para onde mandar o link, e devolver o token na resposta seria
// entregar a conta do cliente para qualquer um que saiba o e-mail dele.
var ErrResetUnavailable = errors.New(
	"recuperacao de senha por e-mail indisponivel no momento. Fale com o atendimento para liberar o acesso.",
)

var ErrResetTokenInvalid = &FieldConflictError{
	Field:   "token",
	Message: "este link de recuperacao expirou ou ja foi usado. Peca um novo.",
}

func hashResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// RequestPasswordReset sempre responde da mesma forma, exista ou nao a conta:
// a tela de "esqueci minha senha" nao pode virar um detector de cadastros.
func (s *Service) RequestPasswordReset(ctx context.Context, identifier string) error {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return &FieldConflictError{Field: "email", Message: "informe seu e-mail ou CPF"}
	}
	if !s.mailer.Configured() && !s.cfg.DebugPasswordResetLink {
		return ErrResetUnavailable
	}

	emailKey, cpfKey := "", ""
	if strings.Contains(identifier, "@") {
		emailKey = normalizeEmail(identifier)
	} else {
		cpfKey = digitsOnly(identifier)
	}

	var customerID, name, email string
	err := s.db.QueryRow(ctx, `
		SELECT id::text, name, email
		FROM customers
		WHERE ($1 <> '' AND lower(email) = $1)
		   OR ($2 <> '' AND regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') = $2)
		LIMIT 1`, emailKey, cpfKey).Scan(&customerID, &name, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	// Pedir um link novo invalida os anteriores que ainda estavam de pe.
	if _, err := s.db.Exec(ctx,
		`UPDATE password_resets SET used_at = NOW() WHERE customer_id = $1 AND used_at IS NULL`,
		customerID); err != nil {
		return err
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	if _, err := s.db.Exec(ctx,
		`INSERT INTO password_resets (customer_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		customerID, hashResetToken(token), time.Now().Add(passwordResetTTL)); err != nil {
		return err
	}

	link := fmt.Sprintf("%s/redefinir-senha?token=%s",
		strings.TrimRight(s.cfg.FrontendURL, "/"), url.QueryEscape(token))

	if !s.mailer.Configured() {
		log.Printf("[reset] SMTP nao configurado - link de %s: %s", email, link)
		return nil
	}

	if err := s.mailer.Send(buildResetEmail(email, firstName(name), link)); err != nil {
		log.Printf("[reset] falha ao enviar e-mail para %s: %v", email, err)
		return ErrResetUnavailable
	}

	return nil
}

func buildResetEmail(to, greeting, link string) mailer.Message {
	if greeting == "" {
		greeting = "Ola"
	} else {
		greeting = "Ola, " + greeting
	}
	safeLink := html.EscapeString(link)

	plain := fmt.Sprintf(`%s!

Recebemos um pedido para redefinir a senha da sua conta na Minha Loja.

Abra o link abaixo para criar uma senha nova. Ele vale por 1 hora e so pode ser usado uma vez:

%s

Se nao foi voce quem pediu, pode ignorar este e-mail: sua senha atual continua valendo.

Minha Loja`, greeting, link)

	htmlBody := fmt.Sprintf(`<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8f5f9;font-family:Arial,Helvetica,sans-serif;color:#2a0f3d">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e3cfee">
    <div style="background:linear-gradient(160deg,#5b247f 0%%,#3a164f 100%%);padding:28px 32px">
      <p style="margin:0;font-size:11px;letter-spacing:3px;color:#e2b04f;font-weight:bold">LOJA ONLINE</p>
      <p style="margin:6px 0 0;font-size:18px;letter-spacing:4px;color:#FAF6EF">MINHA LOJA</p>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 16px;font-size:24px;color:#2a0f3d">%s!</h1>
      <p style="margin:0 0 16px;line-height:1.7;color:#6b665f">
        Recebemos um pedido para redefinir a senha da sua conta. Clique no botao abaixo para criar uma senha nova.
      </p>
      <p style="margin:0 0 24px">
        <a href="%s" style="display:inline-block;background:#5b247f;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:18px;font-weight:bold">
          Redefinir minha senha
        </a>
      </p>
      <p style="margin:0 0 16px;line-height:1.7;color:#6b665f;font-size:13px">
        O link vale por 1 hora e so pode ser usado uma vez. Se o botao nao funcionar, copie este endereco:<br>
        <span style="color:#b77717;word-break:break-all">%s</span>
      </p>
      <p style="margin:0;line-height:1.7;color:#8b847b;font-size:13px">
        Se nao foi voce quem pediu, pode ignorar este e-mail: sua senha atual continua valendo.
      </p>
    </div>
  </div>
</body></html>`, html.EscapeString(greeting), safeLink, safeLink)

	return mailer.Message{
		To:        to,
		Subject:   "Redefinir sua senha - Minha Loja",
		PlainBody: plain,
		HTMLBody:  htmlBody,
	}
}

// ResetPassword consome o token (uso unico) e ja devolve o cliente logado.
func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) (map[string]interface{}, error) {
	if strings.TrimSpace(token) == "" {
		return nil, ErrResetTokenInvalid
	}
	if len(newPassword) < 6 {
		return nil, &FieldConflictError{Field: "password", Message: "a senha precisa ter no minimo 6 caracteres"}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var resetID, customerID string
	err = tx.QueryRow(ctx, `
		SELECT id::text, customer_id::text
		FROM password_resets
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
		FOR UPDATE`, hashResetToken(token)).Scan(&resetID, &customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrResetTokenInvalid
		}
		return nil, err
	}

	var isAdmin bool
	if err := tx.QueryRow(ctx, `SELECT is_admin FROM customers WHERE id = $1`, customerID).Scan(&isAdmin); err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE customers SET password_hash = $1 WHERE id = $2`, string(hash), customerID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE password_resets SET used_at = NOW() WHERE id = $1`, resetID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	// Trocou a senha, some o bloqueio por tentativas erradas.
	clearLoginAttempts(customerID)

	sessionToken, err := auth.GenerateToken(s.cfg.JWTSecret, customerID, customerRole(isAdmin), "customer", customerTokenTTL)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"token": sessionToken}, nil
}
