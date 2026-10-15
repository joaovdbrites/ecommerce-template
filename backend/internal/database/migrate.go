package database

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RunMigrations le todos os arquivos .sql da pasta migrations e executa cada
// um deles no banco, em ordem alfabetica (por isso as migrations usam prefixo
// numerico no nome). As migrations devem ser escritas de forma idempotente,
// para ser seguro rodar essa funcao em todo boot da aplicacao.
func RunMigrations(db *pgxpool.Pool) error {
	ctx := context.Background()
	files, err := os.ReadDir("migrations")
	if err != nil {
		return err
	}

	// Filtra so os arquivos .sql e ordena pelo nome, garantindo que as
	// migrations sejam aplicadas na ordem certa.
	names := make([]string, 0, len(files))
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			names = append(names, file.Name())
		}
	}
	sort.Strings(names)

	// Executa cada migration na ordem, parando no primeiro erro para nao
	// deixar o banco num estado parcialmente migrado sem avisar ninguem.
	for _, name := range names {
		content, err := os.ReadFile(filepath.Join("migrations", name))
		if err != nil {
			return err
		}
		if _, err := db.Exec(ctx, string(content)); err != nil {
			return err
		}
	}

	return nil
}
