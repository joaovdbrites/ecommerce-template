package main

import (
	"log"

	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/database"
	"onperfumaria/backend/internal/handlers"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	if err := database.RunMigrations(db); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	if cfg.AutoSeed {
		if err := database.Seed(db); err != nil {
			log.Fatalf("seed failed: %v", err)
		}
	}

	if cfg.SeedDemoCustomer {
		if err := database.SeedDemoCustomer(db); err != nil {
			log.Fatalf("demo customer seed failed: %v", err)
		}
	}

	if err := database.SeedAdmin(db, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		log.Fatalf("admin seed failed: %v", err)
	}

	router := handlers.NewRouter(cfg, db)

	log.Printf("API listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
