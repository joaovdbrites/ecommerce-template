package database

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Seed(db *pgxpool.Pool) error {
	ctx := context.Background()

	queries := []string{
		`INSERT INTO shipping_rules (name, code, rule_type, amount, min_order_amount, weight_min_grams, weight_max_grams, region_prefix, description, is_active)
		 VALUES
		 ('Frete fixo Brasil', 'fixed', 'fixed', 18.90, NULL, NULL, NULL, NULL, 'Taxa base para envios nacionais', true),
		 ('Frete gratis premium', 'free_over', 'free_over', 0, 349.90, NULL, NULL, NULL, 'Frete gratis acima do valor minimo', true),
		 ('Taxa por peso leve', 'weight_light', 'weight', 4.90, NULL, 0, 1000, NULL, 'Faixa ate 1kg', true),
		 ('Taxa por peso adicional', 'weight_extra', 'weight', 7.50, NULL, 1001, 999999, NULL, 'Faixa acima de 1kg', true),
		 ('Retirada na loja', 'pickup', 'pickup', 0, NULL, NULL, NULL, NULL, 'Retire na loja', true),
		 ('Frete a consultar', 'manual', 'manual', 0, NULL, NULL, NULL, NULL, 'Consultar frete manualmente', true)
		 ON CONFLICT (code) DO UPDATE
		 SET name = EXCLUDED.name,
		     rule_type = EXCLUDED.rule_type,
		     amount = EXCLUDED.amount,
		     min_order_amount = EXCLUDED.min_order_amount,
		     weight_min_grams = EXCLUDED.weight_min_grams,
		     weight_max_grams = EXCLUDED.weight_max_grams,
		     region_prefix = EXCLUDED.region_prefix,
		     description = EXCLUDED.description,
		     is_active = EXCLUDED.is_active;`,
		`INSERT INTO coupons (code, discount_type, value, is_active)
		 VALUES ('BEMVINDA10', 'percent', 10, true)
		 ON CONFLICT (code) DO UPDATE SET value = EXCLUDED.value, is_active = EXCLUDED.is_active;`,
	}

	for _, query := range queries {
		if _, err := db.Exec(ctx, query); err != nil {
			return err
		}
	}

	return nil
}
