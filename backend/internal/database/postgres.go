package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect abre um pool de conexoes com o Postgres, tentando novamente varias
// vezes antes de desistir. Existe porque, em docker-compose, a API costuma
// subir antes do banco estar pronto para aceitar conexoes.
func Connect(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	var pool *pgxpool.Pool
	// Tenta conectar ate 15 vezes, com 2s de espera entre tentativas, dando
	// tempo do Postgres terminar de subir.
	for attempt := 1; attempt <= 15; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		pool, err = pgxpool.NewWithConfig(ctx, config)
		if err == nil {
			err = pool.Ping(ctx)
		}
		cancel()
		if err == nil {
			return pool, nil
		}
		// Fecha o pool que falhou antes de tentar de novo, para nao vazar conexoes.
		if pool != nil {
			pool.Close()
		}
		time.Sleep(2 * time.Second)
	}

	return nil, fmt.Errorf("database unavailable after retries: %w", err)
}
