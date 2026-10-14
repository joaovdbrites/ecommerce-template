import { useEffect, useState } from 'react'
import { Field, SettingsTopic } from '../../pages/OrganizerPage'
import { Button } from '../Button'
import { api } from '../../services/api'
import {
  applyStoreTheme,
  parseTheme,
  BODY_FONT_OPTIONS,
  DEFAULT_STORE_THEME,
  HEADING_FONT_OPTIONS,
  type StoreTheme,
} from '../../hooks/useStoreTheme'

const THEME_KEY_BY_FIELD: Record<keyof StoreTheme, string> = {
  storeName: 'theme_store_name',
  logoUrl: 'theme_logo_url',
  faviconUrl: 'theme_favicon_url',
  bannerUrl: 'theme_banner_url',
  colorPrimary: 'theme_color_primary',
  colorAccent: 'theme_color_accent',
  colorBg: 'theme_color_bg',
  colorSuccess: 'theme_color_success',
  colorError: 'theme_color_error',
  fontHeading: 'theme_font_heading',
  fontBody: 'theme_font_body',
  iconColor: 'theme_icon_color',
  buttonRadius: 'theme_button_radius',
  windowRadius: 'theme_window_radius',
  windowShadow: 'theme_window_shadow',
  density: 'theme_density',
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

// Edita o tema visual do site (cores, tipografia, icones, logo, formato de
// botoes/janelas, densidade). Qualquer mudanca aplica na hora como variavel
// CSS (preview ao vivo, inclusive neste proprio painel) - "Salvar" e so o
// que persiste no backend para a loja publica continuar com o tema depois
// de recarregar a pagina.
export function AppearanceSettings({ token }: { token: string | null }) {
  const [theme, setTheme] = useState<StoreTheme>(DEFAULT_STORE_THEME)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api
      .get<Record<string, string>>('/admin/theme-settings', token ?? undefined)
      .then((data) => {
        const parsed = parseTheme(data)
        setTheme(parsed)
        applyStoreTheme(parsed)
      })
      .catch(() => setNotice('Não foi possível carregar o tema salvo.'))
      .finally(() => setLoading(false))
  }, [token])

  function update<K extends keyof StoreTheme>(field: K, value: StoreTheme[K]) {
    setTheme((current) => {
      const next = { ...current, [field]: value }
      applyStoreTheme(next)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setNotice('')
    try {
      await Promise.all(
        Object.entries(theme).map(([field, value]) =>
          api.put(
            '/admin/theme-settings',
            { key: THEME_KEY_BY_FIELD[field as keyof StoreTheme], value: String(value) },
            token ?? undefined,
          ),
        ),
      )
      setNotice('Aparência salva. Passa a valer no site imediatamente, sem rebuild.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsTopic title="Aparência">
      {loading ? (
        <div className="organizer-surface p-4">
          <p className="text-xs text-[#6b665f]">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <PreviewCard theme={theme} />

          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Identidade</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Nome e imagens que identificam a loja no cabeçalho, na aba do navegador e na home.
            </p>
            <div className="mt-3">
              <Field label="Nome da loja">
                <input
                  value={theme.storeName}
                  onChange={(event) => update('storeName', event.target.value)}
                  placeholder="Minha Loja"
                  className="organizer-input"
                />
              </Field>
              <ImageField
                label="Logo"
                hint="Aparece no cabeçalho no lugar do nome em texto. Deixe vazio para usar o nome."
                value={theme.logoUrl}
                onChange={(value) => update('logoUrl', value)}
              />
              <ImageField
                label="Favicon"
                hint="Ícone pequeno exibido na aba do navegador."
                value={theme.faviconUrl}
                onChange={(value) => update('faviconUrl', value)}
              />
              <ImageField
                label="Banner da home"
                hint="Imagem de destaque opcional na página inicial."
                value={theme.bannerUrl}
                onChange={(value) => update('bannerUrl', value)}
              />
            </div>
          </div>

          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Cores</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Paleta usada em botões, cabeçalho, janelas e mensagens de status.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
              <ColorField label="Primária" value={theme.colorPrimary} onChange={(v) => update('colorPrimary', v)} />
              <ColorField label="Destaque" value={theme.colorAccent} onChange={(v) => update('colorAccent', v)} />
              <ColorField label="Fundo" value={theme.colorBg} onChange={(v) => update('colorBg', v)} />
              <ColorField label="Sucesso" value={theme.colorSuccess} onChange={(v) => update('colorSuccess', v)} />
              <ColorField label="Erro" value={theme.colorError} onChange={(v) => update('colorError', v)} />
            </div>
          </div>

          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Tipografia</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">Fontes usadas em títulos e no texto corrido.</p>
            <div className="mt-3">
              <Field label="Fonte dos títulos">
                <select
                  value={theme.fontHeading}
                  onChange={(event) => update('fontHeading', event.target.value)}
                  className="organizer-input"
                >
                  {HEADING_FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fonte do corpo de texto">
                <select
                  value={theme.fontBody}
                  onChange={(event) => update('fontBody', event.target.value)}
                  className="organizer-input"
                >
                  {BODY_FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Ícones</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Cor de tingimento usada pelos ícones do site e do painel.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
              <ColorField label="Cor dos ícones" value={theme.iconColor} onChange={(v) => update('iconColor', v)} />
            </div>
          </div>

          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Botões</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">Formato dos cantos dos botões em todo o site.</p>
            <div className="mt-3">
              <Field label="Formato">
                <select
                  value={theme.buttonRadius}
                  onChange={(event) => update('buttonRadius', event.target.value as StoreTheme['buttonRadius'])}
                  className="organizer-input"
                >
                  <option value="square">Reto</option>
                  <option value="rounded">Arredondado</option>
                  <option value="pill">Pílula</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Janelas e modais</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Formato dos cantos e intensidade da sombra em janelas, gavetas e caixas de diálogo.
            </p>
            <div className="mt-3">
              <Field label="Formato dos cantos">
                <select
                  value={theme.windowRadius}
                  onChange={(event) => update('windowRadius', event.target.value as StoreTheme['windowRadius'])}
                  className="organizer-input"
                >
                  <option value="square">Reto</option>
                  <option value="rounded">Arredondado</option>
                  <option value="xl">Bem arredondado</option>
                </select>
              </Field>
              <Field label="Sombra">
                <select
                  value={theme.windowShadow}
                  onChange={(event) => update('windowShadow', event.target.value as StoreTheme['windowShadow'])}
                  className="organizer-input"
                >
                  <option value="soft">Leve</option>
                  <option value="medium">Média</option>
                  <option value="strong">Forte</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Espaçamento</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Densidade geral dos espaços internos (botões, janelas e cartões).
            </p>
            <div className="mt-3">
              <Field label="Densidade">
                <select
                  value={theme.density}
                  onChange={(event) => update('density', event.target.value as StoreTheme['density'])}
                  className="organizer-input"
                >
                  <option value="compact">Compacto</option>
                  <option value="comfortable">Confortável</option>
                  <option value="spacious">Espaçoso</option>
                </select>
              </Field>
            </div>
          </div>

          {notice ? <p className="text-xs font-medium text-[#0f8a5f]">{notice}</p> : null}

          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? 'Salvando...' : 'Salvar aparência'}
          </Button>
        </div>
      )}
    </SettingsTopic>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-[#ddc7ea] bg-transparent p-0.5"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="organizer-input"
        />
      </div>
    </Field>
  )
}

function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <p className="mb-1.5 -mt-1 text-[10px] leading-4 text-[#8b847b]">{hint}</p>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg border border-[#ddc7ea] object-contain"
          />
        ) : null}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            readFileAsDataUrl(file).then(onChange)
          }}
          className="organizer-input"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9b5a50] hover:underline"
          >
            Remover
          </button>
        ) : null}
      </div>
    </Field>
  )
}

function PreviewCard({ theme }: { theme: StoreTheme }) {
  return (
    <div
      className="flex flex-wrap items-center gap-4 border p-4"
      style={{
        borderRadius: 'var(--radius-window)',
        borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)',
        boxShadow: 'var(--shadow-window)',
        background: 'var(--color-surface)',
      }}
    >
      <span
        className="text-sm font-semibold tracking-[0.1em]"
        style={{ fontFamily: `var(--font-heading)`, color: 'var(--color-primary)' }}
      >
        {theme.storeName || 'Minha Loja'}
      </span>
      <button
        type="button"
        className="px-5 py-2.5 text-sm font-semibold text-white"
        style={{
          borderRadius: 'var(--radius-button)',
          background: 'linear-gradient(160deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
        }}
      >
        Botão de exemplo
      </button>
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: 'var(--color-accent)', color: 'var(--color-primary-dark)' }}
      >
        Destaque
      </span>
      <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
        Sucesso
      </span>
      <span className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>
        Erro
      </span>
    </div>
  )
}
