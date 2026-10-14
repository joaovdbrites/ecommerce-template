package services

import (
	"context"
	"fmt"
)

// themeSettingKeys sao as chaves editaveis pelo painel de aparencia do admin
// (cores, fontes, logo, formato de botao/janela, densidade). Nao sao
// sensiveis como a gaveta "API" (ver apiSettingKeys) - qualquer admin pode
// ver e editar, mesma regra de store_whatsapp.
var themeSettingKeys = []string{
	"theme_store_name",
	"theme_logo_url",
	"theme_favicon_url",
	"theme_banner_url",
	"theme_color_primary",
	"theme_color_accent",
	"theme_color_bg",
	"theme_color_success",
	"theme_color_error",
	"theme_font_heading",
	"theme_font_body",
	"theme_icon_color",
	"theme_button_radius",
	"theme_window_radius",
	"theme_window_shadow",
	"theme_density",
}

// isThemeSettingKey diz se key esta na lista permitida acima - usada tanto
// pelo service quanto pela rota para rejeitar chaves desconhecidas.
func isThemeSettingKey(key string) bool {
	for _, allowed := range themeSettingKeys {
		if allowed == key {
			return true
		}
	}
	return false
}

// GetThemeSettings le todas as chaves de aparencia de uma vez (mesmo padrao
// de GetAPISettings), preenchendo com "" as que ainda nao foram salvas.
func (s *Service) GetThemeSettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.Query(ctx, `SELECT key, value FROM settings WHERE key = ANY($1)`, themeSettingKeys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		settings[key] = value
	}
	for _, key := range themeSettingKeys {
		if _, ok := settings[key]; !ok {
			settings[key] = ""
		}
	}
	return settings, nil
}

// SaveThemeSetting grava uma chave de aparencia, rejeitando qualquer chave
// fora da lista permitida antes de tocar no banco.
func (s *Service) SaveThemeSetting(ctx context.Context, key, value string) error {
	if !isThemeSettingKey(key) {
		return fmt.Errorf("chave de configuracao invalida")
	}
	return s.SaveSetting(ctx, key, value)
}
