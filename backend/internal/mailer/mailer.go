// Package mailer envia e-mails transacionais da loja (por enquanto so o link de
// recuperacao de senha) usando SMTP da biblioteca padrao, sem dependencia nova.
package mailer

import (
	"crypto/tls"
	"errors"
	"fmt"
	"mime"
	"net"
	"net/smtp"
	"strings"
	"time"
)

// ErrNotConfigured indica que a loja ainda nao tem SMTP preenchido no .env.
var ErrNotConfigured = errors.New("envio de e-mail nao configurado")

type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	From     string
	FromName string
}

type Mailer struct {
	cfg Config
}

func New(cfg Config) *Mailer {
	return &Mailer{cfg: cfg}
}

// Configured diz se da para enviar e-mail. Quem chama decide o que fazer
// quando nao da (avisar o cliente, cair no atendimento manual, etc).
func (m *Mailer) Configured() bool {
	return m.cfg.Host != "" && m.cfg.From != ""
}

type Message struct {
	To        string
	Subject   string
	PlainBody string
	HTMLBody  string
}

func (m *Mailer) Send(message Message) error {
	if !m.Configured() {
		return ErrNotConfigured
	}

	port := m.cfg.Port
	if port == "" {
		port = "587"
	}
	addr := net.JoinHostPort(m.cfg.Host, port)

	client, err := m.dial(addr, port)
	if err != nil {
		return err
	}
	defer client.Close()

	if m.cfg.User != "" {
		auth := smtp.PlainAuth("", m.cfg.User, m.cfg.Password, m.cfg.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("autenticacao SMTP falhou: %w", err)
		}
	}

	if err := client.Mail(m.cfg.From); err != nil {
		return err
	}
	if err := client.Rcpt(message.To); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(m.build(message)); err != nil {
		writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	return client.Quit()
}

// A porta 465 fala TLS desde o primeiro byte; as demais (587, 25) comecam em
// texto puro e sobem para TLS com STARTTLS quando o servidor oferece.
func (m *Mailer) dial(addr, port string) (*smtp.Client, error) {
	tlsConfig := &tls.Config{ServerName: m.cfg.Host, MinVersion: tls.VersionTLS12}

	if port == "465" {
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 15 * time.Second}, "tcp", addr, tlsConfig)
		if err != nil {
			return nil, err
		}
		return smtp.NewClient(conn, m.cfg.Host)
	}

	conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		return nil, err
	}
	client, err := smtp.NewClient(conn, m.cfg.Host)
	if err != nil {
		conn.Close()
		return nil, err
	}
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(tlsConfig); err != nil {
			client.Close()
			return nil, err
		}
	}
	return client, nil
}

func (m *Mailer) build(message Message) []byte {
	from := m.cfg.From
	if m.cfg.FromName != "" {
		from = fmt.Sprintf("%s <%s>", mime.QEncoding.Encode("utf-8", m.cfg.FromName), m.cfg.From)
	}

	boundary := fmt.Sprintf("onperf-%d", time.Now().UnixNano())

	var builder strings.Builder
	builder.WriteString("From: " + from + "\r\n")
	builder.WriteString("To: " + message.To + "\r\n")
	builder.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", message.Subject) + "\r\n")
	builder.WriteString("MIME-Version: 1.0\r\n")
	builder.WriteString(`Content-Type: multipart/alternative; boundary="` + boundary + "\"\r\n\r\n")

	builder.WriteString("--" + boundary + "\r\n")
	builder.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
	builder.WriteString(message.PlainBody + "\r\n\r\n")

	builder.WriteString("--" + boundary + "\r\n")
	builder.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
	builder.WriteString(message.HTMLBody + "\r\n\r\n")

	builder.WriteString("--" + boundary + "--\r\n")

	return []byte(builder.String())
}
