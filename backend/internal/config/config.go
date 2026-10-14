package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	FrontendURL    string
	GoogleClientID string
	AutoSeed       bool
	// Cria a conta de teste do seed_demo.go. So para desenvolvimento.
	SeedDemoCustomer bool
	DefaultTaxFee    float64
	// Garantem a conta fixa de administrador em qualquer ambiente, inclusive
	// producao. Sem as duas, SeedAdmin nao faz nada.
	AdminEmail    string
	AdminPassword string

	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string
	SMTPFromName string
	// Em dev, sem SMTP, imprime o link de recuperacao no log do servidor.
	// Nunca ligar em producao: quem le o log troca a senha de qualquer cliente.
	DebugPasswordResetLink bool
}

func Load() Config {
	_ = godotenv.Load()

	cfg := Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/store?sslmode=disable"),
		JWTSecret:        getEnv("JWT_SECRET", "change-me-in-production"),
		FrontendURL:      getEnv("FRONTEND_URL", "http://localhost:5174"),
		GoogleClientID:   getEnv("GOOGLE_CLIENT_ID", ""),
		AutoSeed:         getEnv("AUTO_SEED", "true") == "true",
		SeedDemoCustomer: getEnv("SEED_DEMO_CUSTOMER", "false") == "true",
		DefaultTaxFee:    getFloatEnv("DEFAULT_TAX_FEE", 4.5),
		AdminEmail:       getEnv("ADMIN_EMAIL", ""),
		AdminPassword:    getEnv("ADMIN_PASSWORD", ""),

		SMTPHost:               getEnv("SMTP_HOST", ""),
		SMTPPort:               getEnv("SMTP_PORT", "587"),
		SMTPUser:               getEnv("SMTP_USER", ""),
		SMTPPassword:           getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:               getEnv("SMTP_FROM", ""),
		SMTPFromName:           getEnv("SMTP_FROM_NAME", "Minha Loja"),
		DebugPasswordResetLink: getEnv("DEBUG_PASSWORD_RESET_LINK", "false") == "true",
	}

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET must be set")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getFloatEnv(key string, fallback float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
