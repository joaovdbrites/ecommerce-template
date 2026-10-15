package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"onperfumaria/backend/internal/auth"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// FieldConflictError aponta exatamente qual campo da ficha ja existe (ou esta
// invalido), para o formulario destacar o campo em vez de mostrar um erro solto.
type FieldConflictError struct {
	Field   string
	Message string
}

// Error satisfaz a interface error devolvendo so a mensagem amigavel.
func (e *FieldConflictError) Error() string { return e.Message }

// Erros de login com Google e padroes de validacao usados em todo o arquivo.
var (
	ErrGoogleNotConfigured = errors.New("login com Google ainda nao configurado nesta loja")
	ErrGoogleInvalidToken  = errors.New("nao foi possivel validar sua conta Google")

	emailPattern  = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]{2,}$`)
	nonDigitsOnly = regexp.MustCompile(`[^0-9]`)
)

// customerTokenTTL e a validade do JWT de sessao do cliente/admin.
const customerTokenTTL = 72 * time.Hour

// CustomerRegistrationPayload e a ficha de cadastro completa: dados pessoais,
// endereco e senha. Tambem e usada para completar o cadastro de quem entrou
// pelo Google e chegou com campos em branco.
type CustomerRegistrationPayload struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	ConfirmEmail    string `json:"confirmEmail"`
	Phone           string `json:"phone"`
	CPF             string `json:"cpf"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
	CEP             string `json:"cep"`
	Street          string `json:"street"`
	Number          string `json:"number"`
	Neighborhood    string `json:"neighborhood"`
	City            string `json:"city"`
	State           string `json:"state"`
}

// digitsOnly remove tudo que nao for digito (usado para normalizar CPF e telefone).
func digitsOnly(value string) string {
	return nonDigitsOnly.ReplaceAllString(value, "")
}

// normalizeEmail poe em minusculas e tira espaco das pontas, para comparacoes
// e buscas no banco serem sempre consistentes.
func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

// isValidCPF confere o formato (11 digitos, nao todos iguais) e os dois
// digitos verificadores pelo algoritmo oficial da Receita Federal.
func isValidCPF(cpf string) bool {
	digits := digitsOnly(cpf)
	if len(digits) != 11 {
		return false
	}
	// CPFs com todos os digitos iguais (ex: 111.111.111-11) passam na conta
	// mas nunca sao validos de verdade.
	if strings.Count(digits, string(digits[0])) == 11 {
		return false
	}
	// Calcula os dois digitos verificadores (posicoes 9 e 10) e compara com
	// o que foi informado.
	for position := 9; position <= 10; position++ {
		sum := 0
		for index := 0; index < position; index++ {
			sum += int(digits[index]-'0') * (position + 1 - index)
		}
		digit := ((sum * 10) % 11) % 10
		if digit != int(digits[position]-'0') {
			return false
		}
	}
	return true
}

// maskEmail esconde parte do usuario do e-mail (ex: "jo***@site.com") para
// mostrar na tela de login sem expor o endereco completo de quem ja tem conta.
func maskEmail(email string) string {
	at := strings.Index(email, "@")
	if at <= 0 {
		return ""
	}
	user, domain := email[:at], email[at:]
	if len(user) <= 2 {
		return user[:1] + "***" + domain
	}
	return user[:2] + strings.Repeat("*", len(user)-2) + domain
}

// customerRole define a claim "role" do JWT: so quem tem is_admin=true no
// banco ganha o papel de administrador, que destrava o Admin (ex-Organizador)
// e as rotas que antes ficavam completamente abertas.
func customerRole(isAdmin bool) string {
	if isAdmin {
		return "admin"
	}
	return "customer"
}

// firstName extrai so o primeiro nome (usado em saudacoes de e-mail/tela).
func firstName(name string) string {
	parts := strings.Fields(name)
	if len(parts) == 0 {
		return ""
	}
	return parts[0]
}

// IdentifyCustomer responde a primeira etapa do login: o cliente digita e-mail
// ou CPF e descobrimos se a conta existe e como ela entra (senha e/ou Google).
func (s *Service) IdentifyCustomer(ctx context.Context, identifier string) (map[string]interface{}, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return nil, &FieldConflictError{Field: "identifier", Message: "informe seu e-mail ou CPF"}
	}

	// Decide se o identificador e e-mail ou CPF pela presenca de "@", e
	// valida o formato de acordo.
	kind := "email"
	if !strings.Contains(identifier, "@") {
		kind = "cpf"
		if !isValidCPF(identifier) {
			return nil, &FieldConflictError{Field: "identifier", Message: "informe um e-mail valido ou um CPF valido"}
		}
	} else if !emailPattern.MatchString(normalizeEmail(identifier)) {
		return nil, &FieldConflictError{Field: "identifier", Message: "informe um e-mail valido"}
	}

	emailKey, cpfKey := "", ""
	if kind == "email" {
		emailKey = normalizeEmail(identifier)
	} else {
		cpfKey = digitsOnly(identifier)
	}

	var id, name, email, passwordHash, googleSub string
	err := s.db.QueryRow(ctx, `
		SELECT id::text, name, email, COALESCE(password_hash, ''), COALESCE(google_sub, '')
		FROM customers
		WHERE ($1 <> '' AND lower(email) = $1)
		   OR ($2 <> '' AND regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') = $2)
		LIMIT 1`, emailKey, cpfKey).Scan(&id, &name, &email, &passwordHash, &googleSub)

	// Conta nao encontrada: devolve "exists: false" em vez de erro, para o
	// front oferecer o cadastro.
	if errors.Is(err, pgx.ErrNoRows) {
		return map[string]interface{}{
			"exists":         false,
			"identifierType": kind,
			"hasPassword":    false,
			"hasGoogle":      false,
		}, nil
	}
	if err != nil {
		return nil, err
	}

	// Conta existe: informa quais metodos de login estao disponiveis para
	// o front decidir se mostra campo de senha, botao do Google, ou ambos.
	return map[string]interface{}{
		"exists":         true,
		"identifierType": kind,
		"hasPassword":    passwordHash != "",
		"hasGoogle":      googleSub != "",
		"firstName":      firstName(name),
		"maskedEmail":    maskEmail(email),
	}, nil
}

// CustomerLogin autentica por e-mail ou CPF. O identificador vazio cai no
// e-mail para manter compatibilidade com quem ainda chama a rota antiga.
func (s *Service) CustomerLoginIdentifier(ctx context.Context, identifier, password string) (string, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" || password == "" {
		return "", ErrInvalidCredentials
	}

	emailKey := ""
	cpfKey := ""
	if strings.Contains(identifier, "@") {
		emailKey = normalizeEmail(identifier)
	} else {
		cpfKey = digitsOnly(identifier)
	}

	var id, hash, googleSub string
	var isAdmin bool
	err := s.db.QueryRow(ctx, `
		SELECT id::text, COALESCE(password_hash, ''), COALESCE(google_sub, ''), is_admin
		FROM customers
		WHERE ($1 <> '' AND lower(email) = $1)
		   OR ($2 <> '' AND regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') = $2)
		LIMIT 1`, emailKey, cpfKey).Scan(&id, &hash, &googleSub, &isAdmin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}

	// Freio de forca bruta: se a conta esta trancada por excesso de senhas
	// erradas, nem chega a comparar a senha enviada agora.
	if locked := loginLockRemaining(id); locked > 0 {
		minutes := int(locked.Minutes()) + 1
		return "", &FieldConflictError{
			Field:   "password",
			Message: fmt.Sprintf("muitas tentativas de senha. Aguarde %d minutos ou use \"Esqueci minha senha\".", minutes),
		}
	}

	// Conta sem senha cadastrada: so pode ter entrado pelo Google, entao
	// orienta a usar o botao certo em vez de um erro generico de senha.
	if hash == "" {
		if googleSub != "" {
			return "", &FieldConflictError{
				Field:   "password",
				Message: "esta conta foi criada com o Google. Entre com o Google para acessar.",
			}
		}
		return "", ErrInvalidCredentials
	}

	// Senha errada: conta como falha para o freio de login antes de
	// devolver o erro generico (nao revela se foi usuario ou senha).
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		recordLoginFailure(id)
		return "", ErrInvalidCredentials
	}

	clearLoginAttempts(id)
	return auth.GenerateToken(s.cfg.JWTSecret, id, customerRole(isAdmin), "customer", customerTokenTTL)
}

// CustomerFieldConflicts devolve, campo a campo, o que ja existe no banco.
// excludeID evita que o proprio cliente colida consigo mesmo ao completar a ficha.
func (s *Service) CustomerFieldConflicts(ctx context.Context, email, cpf, phone, excludeID string) ([]map[string]string, error) {
	conflicts := []map[string]string{}

	// Cada entrada descreve um campo unico a conferir: a condicao SQL e a
	// mensagem de erro caso ja exista outro cliente com esse valor.
	checks := []struct {
		field   string
		value   string
		where   string
		message string
	}{
		{"email", normalizeEmail(email), `lower(email) = $1`, "este e-mail ja esta cadastrado"},
		{"cpf", digitsOnly(cpf), `regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') = $1`, "este CPF ja esta cadastrado"},
		{"phone", digitsOnly(phone), `regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1`, "este telefone ja esta cadastrado"},
	}

	// Roda cada checagem; campo vazio (nao informado) e pulado. excludeID
	// (via $2) impede que o proprio registro conte como conflito consigo mesmo.
	for _, check := range checks {
		if check.value == "" {
			continue
		}
		query := fmt.Sprintf(`SELECT EXISTS(SELECT 1 FROM customers WHERE %s AND ($2 = '' OR id::text <> $2))`, check.where)
		var exists bool
		if err := s.db.QueryRow(ctx, query, check.value, excludeID).Scan(&exists); err != nil {
			return nil, err
		}
		if exists {
			conflicts = append(conflicts, map[string]string{"field": check.field, "message": check.message})
		}
	}

	return conflicts, nil
}

// validateRegistration confere, campo a campo, a ficha de cadastro/edicao de
// perfil. requirePassword e false quando o cliente ja tem senha (ex: so esta
// completando endereco) e so exige senha nova se uma foi de fato enviada.
func validateRegistration(payload CustomerRegistrationPayload, requirePassword bool) error {
	if strings.TrimSpace(payload.Name) == "" {
		return &FieldConflictError{Field: "name", Message: "informe seu nome completo"}
	}
	if !emailPattern.MatchString(normalizeEmail(payload.Email)) {
		return &FieldConflictError{Field: "email", Message: "informe um e-mail valido"}
	}
	if payload.ConfirmEmail != "" && normalizeEmail(payload.ConfirmEmail) != normalizeEmail(payload.Email) {
		return &FieldConflictError{Field: "confirmEmail", Message: "os e-mails nao conferem"}
	}
	if len(digitsOnly(payload.Phone)) < 10 {
		return &FieldConflictError{Field: "phone", Message: "informe um telefone com DDD"}
	}
	if !isValidCPF(payload.CPF) {
		return &FieldConflictError{Field: "cpf", Message: "informe um CPF valido"}
	}
	if requirePassword || payload.Password != "" {
		if len(payload.Password) < 6 {
			return &FieldConflictError{Field: "password", Message: "a senha precisa ter no minimo 6 caracteres"}
		}
		if payload.ConfirmPassword != "" && payload.Password != payload.ConfirmPassword {
			return &FieldConflictError{Field: "confirmPassword", Message: "as senhas nao conferem"}
		}
	}
	if len(digitsOnly(payload.CEP)) != 8 {
		return &FieldConflictError{Field: "cep", Message: "informe um CEP valido"}
	}
	if strings.TrimSpace(payload.Street) == "" {
		return &FieldConflictError{Field: "street", Message: "informe a rua"}
	}
	if strings.TrimSpace(payload.Number) == "" {
		return &FieldConflictError{Field: "number", Message: "informe o numero"}
	}
	if strings.TrimSpace(payload.Neighborhood) == "" {
		return &FieldConflictError{Field: "neighborhood", Message: "informe o bairro"}
	}
	if strings.TrimSpace(payload.City) == "" {
		return &FieldConflictError{Field: "city", Message: "informe a cidade"}
	}
	if strings.TrimSpace(payload.State) == "" {
		return &FieldConflictError{Field: "state", Message: "informe o estado"}
	}
	return nil
}

// RegisterCustomer grava a ficha de cadastro. Com customerID preenchido ela
// completa um cadastro existente (o caso de quem entrou pelo Google e voltou
// para preencher o que a API do Google nao entrega).
func (s *Service) RegisterCustomer(ctx context.Context, customerID string, payload CustomerRegistrationPayload) (map[string]interface{}, error) {
	existingHasPassword := false
	existingIsAdmin := false
	// Se customerID veio preenchido, e uma edicao/complemento de cadastro
	// ja existente (fluxo do Google) - busca se ja tem senha e se e admin.
	if customerID != "" {
		var hash string
		err := s.db.QueryRow(ctx, `SELECT COALESCE(password_hash, ''), is_admin FROM customers WHERE id = $1`, customerID).Scan(&hash, &existingIsAdmin)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errors.New("cadastro nao encontrado")
			}
			return nil, err
		}
		existingHasPassword = hash != ""
	}

	if err := validateRegistration(payload, !existingHasPassword); err != nil {
		return nil, err
	}

	// Confere duplicidade de e-mail/CPF/telefone antes de gravar qualquer coisa.
	conflicts, err := s.CustomerFieldConflicts(ctx, payload.Email, payload.CPF, payload.Phone, customerID)
	if err != nil {
		return nil, err
	}
	if len(conflicts) > 0 {
		return nil, &FieldConflictError{Field: conflicts[0]["field"], Message: conflicts[0]["message"]}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	email := normalizeEmail(payload.Email)
	name := strings.TrimSpace(payload.Name)

	// Sem customerID: e cadastro novo, cria a linha ja com a senha com hash.
	if customerID == "" {
		hash, hashErr := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
		if hashErr != nil {
			return nil, hashErr
		}
		if err := tx.QueryRow(ctx, `
			INSERT INTO customers (name, email, phone, cpf, password_hash)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id::text`, name, email, payload.Phone, payload.CPF, string(hash)).Scan(&customerID); err != nil {
			return nil, err
		}
	} else {
		// Com customerID: atualiza os dados pessoais do cadastro existente e,
		// se uma senha nova foi enviada, atualiza ela tambem (opcional aqui).
		if _, err := tx.Exec(ctx, `UPDATE customers SET name = $1, email = $2, phone = $3, cpf = $4 WHERE id = $5`,
			name, email, payload.Phone, payload.CPF, customerID); err != nil {
			return nil, err
		}
		if payload.Password != "" {
			hash, hashErr := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
			if hashErr != nil {
				return nil, hashErr
			}
			if _, err := tx.Exec(ctx, `UPDATE customers SET password_hash = $1 WHERE id = $2`, string(hash), customerID); err != nil {
				return nil, err
			}
		}
	}

	// Grava/atualiza o endereco na mesma transacao do cadastro.
	if _, err := s.ensureAddress(ctx, tx, customerID, payload.CEP, payload.Street, payload.Number, payload.Neighborhood, payload.City, payload.State); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	token, err := auth.GenerateToken(s.cfg.JWTSecret, customerID, customerRole(existingIsAdmin), "customer", customerTokenTTL)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{"token": token, "needsProfile": false}, nil
}

// googleTokenInfo e o subconjunto da resposta do endpoint tokeninfo do
// Google que interessa para autenticar e preencher o cadastro inicial.
type googleTokenInfo struct {
	Sub           string `json:"sub"`
	Aud           string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// verifyGoogleCredential valida o id_token do Google chamando o endpoint
// oficial de tokeninfo (em vez de so decodificar o JWT localmente) e confere
// se o "aud" bate com o client ID configurado desta loja e o e-mail e verificado.
func (s *Service) verifyGoogleCredential(ctx context.Context, credential string) (*googleTokenInfo, error) {
	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(credential)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, ErrGoogleInvalidToken
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, ErrGoogleInvalidToken
	}

	var info googleTokenInfo
	if err := json.NewDecoder(response.Body).Decode(&info); err != nil {
		return nil, ErrGoogleInvalidToken
	}
	// aud precisa ser exatamente o client ID desta loja - senao e um token
	// valido do Google mas emitido para outra aplicacao.
	if info.Sub == "" || info.Aud != s.resolveGoogleClientID(ctx) {
		return nil, ErrGoogleInvalidToken
	}
	if info.Email == "" || info.EmailVerified != "true" {
		return nil, ErrGoogleInvalidToken
	}

	return &info, nil
}

// GoogleSignIn entra com a conta Google. Se ainda nao existe cadastro, cria com
// o que a API do Google entrega (nome, e-mail, foto), deixa o resto em branco e
// avisa o front para abrir a ficha de cadastro com os campos que faltam.
func (s *Service) GoogleSignIn(ctx context.Context, credential string) (map[string]interface{}, error) {
	if s.resolveGoogleClientID(ctx) == "" {
		return nil, ErrGoogleNotConfigured
	}
	if strings.TrimSpace(credential) == "" {
		return nil, ErrGoogleInvalidToken
	}

	info, err := s.verifyGoogleCredential(ctx, credential)
	if err != nil {
		return nil, err
	}

	email := normalizeEmail(info.Email)
	name := strings.TrimSpace(info.Name)
	if name == "" {
		name = strings.TrimSpace(info.GivenName + " " + info.FamilyName)
	}

	// Busca por google_sub (ja logou com Google antes) ou por e-mail (tem
	// cadastro feito por senha e esta logando com Google pela primeira vez);
	// o ORDER BY prioriza o match por google_sub quando os dois existirem.
	var customerID, storedPhone, storedCPF string
	var isAdmin bool
	err = s.db.QueryRow(ctx, `
		SELECT id::text, COALESCE(phone, ''), COALESCE(cpf, ''), is_admin
		FROM customers
		WHERE google_sub = $1 OR lower(email) = $2
		ORDER BY (google_sub = $1) DESC
		LIMIT 1`, info.Sub, email).Scan(&customerID, &storedPhone, &storedCPF, &isAdmin)

	switch {
	// Cliente novo: cria o cadastro so com o que o Google entregou (telefone
	// e CPF ficam em branco ate o cliente completar a ficha).
	case errors.Is(err, pgx.ErrNoRows):
		if insertErr := s.db.QueryRow(ctx, `
			INSERT INTO customers (name, email, phone, cpf, password_hash, google_sub, avatar_url)
			VALUES ($1, $2, '', '', '', $3, $4)
			RETURNING id::text`, name, email, info.Sub, info.Picture).Scan(&customerID); insertErr != nil {
			return nil, insertErr
		}
	case err != nil:
		return nil, err
	// Cliente ja existia (por google_sub ou por e-mail): vincula o
	// google_sub e preenche avatar/nome so se ainda estiverem vazios, sem
	// sobrescrever o que o cliente ja tinha preenchido manualmente.
	default:
		if _, updateErr := s.db.Exec(ctx, `
			UPDATE customers
			SET google_sub = $1,
			    avatar_url = COALESCE(NULLIF($2, ''), avatar_url),
			    name = CASE WHEN COALESCE(name, '') = '' THEN $3 ELSE name END
			WHERE id = $4`, info.Sub, info.Picture, name, customerID); updateErr != nil {
			return nil, updateErr
		}
	}

	// Confere se ja tem endereco cadastrado para decidir se o front precisa
	// abrir a tela de completar perfil.
	var hasAddress bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE customer_id = $1)`, customerID).Scan(&hasAddress); err != nil {
		return nil, err
	}

	token, err := auth.GenerateToken(s.cfg.JWTSecret, customerID, customerRole(isAdmin), "customer", customerTokenTTL)
	if err != nil {
		return nil, err
	}

	// Falta telefone, CPF ou endereco: cadastro incompleto, front deve pedir
	// esses dados antes de liberar checkout.
	needsProfile := storedPhone == "" || storedCPF == "" || !hasAddress

	return map[string]interface{}{
		"token":        token,
		"needsProfile": needsProfile,
		"profile": map[string]interface{}{
			"name":      name,
			"email":     email,
			"phone":     storedPhone,
			"cpf":       storedCPF,
			"avatarUrl": info.Picture,
		},
	}, nil
}
