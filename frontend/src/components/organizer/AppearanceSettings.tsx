import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field, SettingsTopic, StoreWhatsappSettings } from '../../pages/OrganizerPage'
import { Button } from '../Button'
import { api } from '../../services/api'
import {
  applyStoreTheme,
  parseTheme,
  BODY_FONT_OPTIONS,
  DEFAULT_STORE_THEME,
  HEADING_FONT_OPTIONS,
  type StoreLink,
  type StoreTheme,
} from '../../hooks/useStoreTheme'

// Mapeia cada campo do StoreTheme para a chave usada na tabela de settings
// do backend (endpoint /admin/theme-settings), uma linha por chave salva.
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
  footerDescription: 'theme_footer_description',
  contactEmail: 'theme_contact_email',
  instagramUrl: 'theme_instagram_url',
  extraLinks: 'theme_extra_links',
}

// Converte o valor de um campo do tema para string antes de enviar ao
// backend - extraLinks e uma lista, entao precisa virar JSON primeiro.
function serializeThemeValue(field: keyof StoreTheme, value: StoreTheme[keyof StoreTheme]): string {
  if (field === 'extraLinks') return JSON.stringify(value)
  return String(value)
}

// Gera um id unico para cada link extra do rodape (usa crypto.randomUUID
// quando disponivel, com um fallback simples baseado em timestamp).
function createLinkId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `link-${Date.now()}`
}

// Le um arquivo de imagem escolhido pelo admin (logo, favicon, banner) e
// devolve como data URL, para poder salvar direto no valor do tema.
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
  // Estado local do tema sendo editado, inicializado com os valores padrao
  // ate o fetch abaixo trazer o que esta salvo no backend.
  const [theme, setTheme] = useState<StoreTheme>(DEFAULT_STORE_THEME)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Busca o tema salvo assim que o painel monta (ou o token muda) e ja
  // aplica no CSS na hora, pra esse mesmo painel renderizar com o tema real.
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

  // Atualiza um campo do tema no estado e reaplica as variaveis CSS na hora -
  // e assim que o preview ao vivo funciona antes de clicar em "Salvar".
  function update<K extends keyof StoreTheme>(field: K, value: StoreTheme[K]) {
    setTheme((current) => {
      const next = { ...current, [field]: value }
      applyStoreTheme(next)
      return next
    })
  }

  // Persiste todos os campos do tema no backend (um PUT por chave) para que
  // a loja publica continue com o tema depois de recarregar a pagina.
  async function handleSave() {
    setSaving(true)
    setNotice('')
    try {
      await Promise.all(
        (Object.keys(theme) as Array<keyof StoreTheme>).map((field) =>
          api.put(
            '/admin/theme-settings',
            { key: THEME_KEY_BY_FIELD[field], value: serializeThemeValue(field, theme[field]) },
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
      {/* Enquanto o fetch do tema nao termina, mostra so um aviso de
          carregando no lugar do formulario inteiro. */}
      {loading ? (
        <div className="organizer-surface p-4">
          <p className="text-xs text-[#6b665f]">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <PreviewCard theme={theme} />

          {/* Nome da loja e imagens (logo, favicon, banner da home). */}
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

          {/* Paleta de cores (primaria, destaque, fundo, sucesso, erro). */}
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

          {/* Fonte dos titulos e do corpo de texto do site. */}
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

          {/* Cor de tingimento aplicada nos icones do site e do painel. */}
          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Ícones</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Cor de tingimento usada pelos ícones do site e do painel.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
              <ColorField label="Cor dos ícones" value={theme.iconColor} onChange={(v) => update('iconColor', v)} />
            </div>
          </div>

          {/* Formato dos cantos dos botoes (reto, arredondado ou pilula). */}
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

          {/* Formato dos cantos e intensidade da sombra de janelas/modais. */}
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

          {/* Densidade geral dos espacos internos (compacto/confortavel/espacoso). */}
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

          {/* Texto do rodape, WhatsApp, e-mail de contato, Instagram e links extras. */}
          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Rodapé e redes sociais</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Texto de apresentação e links de contato exibidos no rodapé do site.
            </p>
            <div className="mt-3">
              <Field label="Texto do rodapé">
                <textarea
                  value={theme.footerDescription}
                  onChange={(event) => update('footerDescription', event.target.value)}
                  rows={3}
                  className="organizer-input resize-none"
                />
              </Field>
            </div>
            <StoreWhatsappSettings token={token} />
            <div className="mt-3">
              <Field label="E-mail de contato">
                <input
                  value={theme.contactEmail}
                  onChange={(event) => update('contactEmail', event.target.value)}
                  placeholder="contato@minhaloja.com"
                  className="organizer-input"
                />
              </Field>
              <Field label="Instagram (link completo)">
                <input
                  value={theme.instagramUrl}
                  onChange={(event) => update('instagramUrl', event.target.value)}
                  placeholder="https://instagram.com/minhaloja"
                  className="organizer-input"
                />
              </Field>
            </div>
            <ExtraLinksEditor
              links={theme.extraLinks}
              onChange={(links) => update('extraLinks', links)}
            />
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

// Campo de cor com color picker nativo + input de texto em paralelo, os
// dois sincronizados com o mesmo valor (hex).
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

// Campo de upload de imagem (logo, favicon, banner): mostra uma previa
// quando ja tem valor, um input de arquivo e um botao para remover.
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

// Editor da lista de links extras do rodape (ex.: TikTok, Pinterest) -
// permite adicionar, editar e remover links livres alem de Instagram/e-mail.
function ExtraLinksEditor({
  links,
  onChange,
}: {
  links: StoreLink[]
  onChange: (links: StoreLink[]) => void
}) {
  // Atualiza so o link com o id informado, mantendo os demais intactos.
  function updateLink(id: string, changes: Partial<StoreLink>) {
    onChange(links.map((link) => (link.id === id ? { ...link, ...changes } : link)))
  }

  function removeLink(id: string) {
    onChange(links.filter((link) => link.id !== id))
  }

  // Adiciona um link vazio com um novo id - o admin preenche nome e url depois.
  function addLink() {
    onChange([...links, { id: createLinkId(), label: '', url: '' }])
  }

  return (
    <div className="mt-3">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b665f]">
        Links adicionais
      </span>
      <div className="space-y-2">
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-2">
            <input
              value={link.label}
              onChange={(event) => updateLink(link.id, { label: event.target.value })}
              placeholder="Nome (ex.: TikTok)"
              className="organizer-input w-32 shrink-0"
            />
            <input
              value={link.url}
              onChange={(event) => updateLink(link.id, { url: event.target.value })}
              placeholder="https://..."
              className="organizer-input"
            />
            <button
              type="button"
              aria-label="Remover link"
              onClick={() => removeLink(link.id)}
              className="shrink-0 rounded-full p-1.5 text-[#9b5a50] hover:bg-[#fff0ed]"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addLink}
        className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b77717] hover:underline"
      >
        <Plus size={12} /> Adicionar link
      </button>
    </div>
  )
}

// Cartao de preview ao vivo no topo do painel: mostra nome da loja, um
// botao, uma tag de destaque e os textos de sucesso/erro com as cores e
// fontes atuais do tema, sem precisar salvar nem recarregar a pagina.
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
