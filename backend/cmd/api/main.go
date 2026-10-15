package main

import (
	"log"

	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/database"
	"onperfumaria/backend/internal/handlers"
)

// main inicializa a configuracao, conecta no banco, aplica migrations e
// seeds, e sobe o servidor HTTP da API.
func main() {
	// Le as variaveis de ambiente (ou .env) e monta a configuracao da aplicacao.
	cfg := config.Load()

	// Abre o pool de conexoes com o Postgres, tentando de novo ate o banco subir.
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	// Aplica as migrations pendentes antes de aceitar qualquer requisicao.
	if err := database.RunMigrations(db); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	// Dados base da loja (frete, cupom etc.), ligados por padrao.
	if cfg.AutoSeed {
		if err := database.Seed(db); err != nil {
			log.Fatalf("seed failed: %v", err)
		}
	}

	// Conta de cliente de teste, so quando explicitamente habilitada (dev/homologacao).
	if cfg.SeedDemoCustomer {
		if err := database.SeedDemoCustomer(db); err != nil {
			log.Fatalf("demo customer seed failed: %v", err)
		}
	}

	// Garante a conta fixa de administrador quando ADMIN_EMAIL/ADMIN_PASSWORD
	// estao definidos; sem eles, a funcao nao faz nada.
	if err := database.SeedAdmin(db, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		log.Fatalf("admin seed failed: %v", err)
	}

	// Monta as rotas HTTP com a configuracao e o banco ja prontos.
	router := handlers.NewRouter(cfg, db)

	// Sobe o servidor e bloqueia aqui ate ele parar.
	log.Printf("API listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
