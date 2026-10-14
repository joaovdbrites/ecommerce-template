package database

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SeedAdmin garante que a conta fixa de administrador exista e tenha a senha
// configurada, em qualquer ambiente (inclusive producao). So roda quando
// ADMIN_EMAIL e ADMIN_PASSWORD estao definidos: sem eles, nada acontece.
//
// Isso resolve o problema de bootstrap: sem nenhum admin cadastrado ainda,
// ninguem consegue abrir o Admin para promover a primeira conta. Definindo
// essas duas variaveis de ambiente e reiniciando o servidor, a conta sempre
// fica pronta e com a senha mais recente - inclusive se alguem perder o
// acesso por engano, como ja aconteceu em desenvolvimento.
func SeedAdmin(db *pgxpool.Pool, email, password string) error {
	if email == "" || password == "" {
		return nil
	}

	ctx := context.Background()

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if _, err := db.Exec(ctx, `
		INSERT INTO customers (name, email, phone, cpf, password_hash, is_admin, is_fixed_admin)
		VALUES ('Administrador', $1, '', NULL, $2, true, true)
		ON CONFLICT (email) DO UPDATE
		SET password_hash = EXCLUDED.password_hash,
		    is_admin = true,
		    is_fixed_admin = true`,
		email, string(hash),
	); err != nil {
		return err
	}

	log.Printf("[seed] administrador fixo pronto: %s", email)
	return nil
}
