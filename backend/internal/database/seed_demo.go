package database

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Conta de demonstracao para testar login, checkout e recuperacao de senha sem
// precisar criar cadastro na mao. So e criada quando SEED_DEMO_CUSTOMER=true,
// que o docker-compose.dev.yml liga e o de producao nao: uma conta com senha
// conhecida publicada na loja real seria uma porta aberta.
//
//	e-mail ...: teste@minhaloja.local
//	CPF .......: 111.444.777-35
//	telefone ..: (67) 99999-0000
//	senha .....: teste1234
const (
	demoCustomerName     = "Cliente Teste"
	demoCustomerEmail    = "teste@minhaloja.local"
	demoCustomerPhone    = "(67) 99999-0000"
	demoCustomerCPF      = "111.444.777-35"
	demoCustomerPassword = "teste1234"
)

// SeedDemoCustomer recria a conta de teste a cada boot, inclusive a senha, para
// ela continuar previsivel depois de um teste de recuperacao de senha.
func SeedDemoCustomer(db *pgxpool.Pool) error {
	ctx := context.Background()

	// Hash da senha fixa de teste, gerado a cada boot (bcrypt usa um salt
	// novo toda vez, entao o hash muda mesmo a senha sendo sempre a mesma).
	hash, err := bcrypt.GenerateFromPassword([]byte(demoCustomerPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Cria o cliente de teste ou atualiza os dados dele se ja existir,
	// sempre devolvendo o id para usar no endereco logo abaixo.
	var customerID string
	err = db.QueryRow(ctx, `
		INSERT INTO customers (name, email, phone, cpf, password_hash)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (email) DO UPDATE
		SET name = EXCLUDED.name,
		    phone = EXCLUDED.phone,
		    cpf = EXCLUDED.cpf,
		    password_hash = EXCLUDED.password_hash
		RETURNING id::text`,
		demoCustomerName, demoCustomerEmail, demoCustomerPhone, demoCustomerCPF, string(hash),
	).Scan(&customerID)
	if err != nil {
		return err
	}

	// So cria o endereco padrao se o cliente ainda nao tiver nenhum, para nao
	// duplicar endereco a cada reinicio do servidor.
	if _, err := db.Exec(ctx, `
		INSERT INTO addresses (customer_id, label, cep, street, number, neighborhood, city, state, is_default)
		SELECT $1, 'Principal', '79044-480', 'Rua Doutor Fauze Saueia', '100', 'Jardim Los Angeles', 'CAMPO GRANDE', 'MS', true
		WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE customer_id = $1)`, customerID); err != nil {
		return err
	}

	log.Printf("[seed] conta de teste pronta: %s (senha em internal/database/seed_demo.go)", demoCustomerEmail)
	return nil
}
