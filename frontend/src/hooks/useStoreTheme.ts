import { useEffect, useState } from 'react'
import { api } from '../services/api'

// Presets de estilo que o lojista escolhe em Configuracoes > Aparencia -
// cada um mapeia para um valor concreto de CSS (ver os Record *_PX/*_SCALE abaixo).
export type ButtonRadiusPreset = 'square' | 'rounded' | 'pill'
export type WindowRadiusPreset = 'square' | 'rounded' | 'xl'
export type WindowShadowPreset = 'soft' | 'medium' | 'strong'
export type DensityPreset = 'compact' | 'comfortable' | 'spacious'

// Link extra configuravel pelo lojista (ex.: redes sociais, paginas externas)
// exibido no rodape da loja.
export type StoreLink = {
  id: string
  label: string
  url: string
}

// Configuracao visual completa da loja: cores, fontes, formatos de
// botao/janela e textos institucionais do rodape. E o formato "tipado" usado
// pela UI, convertido a partir das chaves cruas `theme_*` vindas da API (ver parseTheme).
export type StoreTheme = {
  storeName: string
  logoUrl: string
  faviconUrl: string
  bannerUrl: string
  colorPrimary: string
  colorAccent: string
  colorBg: string
  colorSuccess: string
  colorError: string
  fontHeading: string
  fontBody: string
  iconColor: string
  buttonRadius: ButtonRadiusPreset
  windowRadius: WindowRadiusPreset
  windowShadow: WindowShadowPreset
  density: DensityPreset
  footerDescription: string
  contactEmail: string
  instagramUrl: string
  extraLinks: StoreLink[]
}

// Tema aplicado antes da config real da loja chegar da API (e tambem usado
// como fallback de cada campo individual em parseTheme).
export const DEFAULT_STORE_THEME: StoreTheme = {
  storeName: 'Minha Loja',
  logoUrl: '',
  faviconUrl: '',
  bannerUrl: '',
  colorPrimary: '#5b247f',
  colorAccent: '#d89a28',
  colorBg: '#f8f5f9',
  colorSuccess: '#0f8a5f',
  colorError: '#a0382f',
  fontHeading: 'Cormorant Garamond',
  fontBody: 'Montserrat',
  iconColor: '#d89a28',
  buttonRadius: 'rounded',
  windowRadius: 'rounded',
  windowShadow: 'medium',
  density: 'comfortable',
  footerDescription:
    'Selecionamos cada produto com cuidado para oferecer uma experiência de compra confiável, do primeiro clique até a entrega na sua porta.',
  contactEmail: 'contato@minhaloja.com',
  instagramUrl: '',
  extraLinks: [],
}

// Fontes do Google Fonts oferecidas no seletor de Aparencia (titulos e corpo
// de texto separados, ja que cada uma tem opcoes com pesos/estilos diferentes).
export const HEADING_FONT_OPTIONS = ['Cormorant Garamond', 'Playfair Display', 'Merriweather', 'Lora', 'Poppins']
export const BODY_FONT_OPTIONS = ['Montserrat', 'Inter', 'Manrope', 'Roboto', 'Open Sans']

// Tabelas de conversao preset -> valor CSS concreto, usadas por applyStoreTheme.
const BUTTON_RADIUS_PX: Record<ButtonRadiusPreset, string> = {
  square: '8px',
  rounded: '20px',
  pill: '999px',
}
const WINDOW_RADIUS_PX: Record<WindowRadiusPreset, string> = {
  square: '12px',
  rounded: '24px',
  xl: '32px',
}
const WINDOW_SHADOW_STRENGTH: Record<WindowShadowPreset, string> = {
  soft: '40%',
  medium: '70%',
  strong: '90%',
}
const DENSITY_SCALE: Record<DensityPreset, string> = {
  compact: '0.85',
  comfortable: '1',
  spacious: '1.15',
}

type RawThemeSettings = Record<string, string>

/** Converte as chaves cruas `theme_*` (vindas de /admin/theme-settings ou do
 * objeto `theme` de /store/config) no formato tipado usado pela UI. */
export function parseTheme(raw: RawThemeSettings | undefined | null): StoreTheme {
  if (!raw) return DEFAULT_STORE_THEME
  return {
    storeName: raw.theme_store_name || DEFAULT_STORE_THEME.storeName,
    logoUrl: raw.theme_logo_url || '',
    faviconUrl: raw.theme_favicon_url || '',
    bannerUrl: raw.theme_banner_url || '',
    colorPrimary: raw.theme_color_primary || DEFAULT_STORE_THEME.colorPrimary,
    colorAccent: raw.theme_color_accent || DEFAULT_STORE_THEME.colorAccent,
    colorBg: raw.theme_color_bg || DEFAULT_STORE_THEME.colorBg,
    colorSuccess: raw.theme_color_success || DEFAULT_STORE_THEME.colorSuccess,
    colorError: raw.theme_color_error || DEFAULT_STORE_THEME.colorError,
    fontHeading: raw.theme_font_heading || DEFAULT_STORE_THEME.fontHeading,
    fontBody: raw.theme_font_body || DEFAULT_STORE_THEME.fontBody,
    iconColor: raw.theme_icon_color || DEFAULT_STORE_THEME.iconColor,
    buttonRadius: (raw.theme_button_radius as ButtonRadiusPreset) || DEFAULT_STORE_THEME.buttonRadius,
    windowRadius: (raw.theme_window_radius as WindowRadiusPreset) || DEFAULT_STORE_THEME.windowRadius,
    windowShadow: (raw.theme_window_shadow as WindowShadowPreset) || DEFAULT_STORE_THEME.windowShadow,
    density: (raw.theme_density as DensityPreset) || DEFAULT_STORE_THEME.density,
    footerDescription: raw.theme_footer_description || DEFAULT_STORE_THEME.footerDescription,
    contactEmail: raw.theme_contact_email || DEFAULT_STORE_THEME.contactEmail,
    instagramUrl: raw.theme_instagram_url || '',
    extraLinks: parseExtraLinks(raw.theme_extra_links),
  }
}

// Desserializa a lista de links extras (salva como JSON em uma unica chave
// `theme_extra_links`) e filtra qualquer entrada que nao tenha o formato
// esperado, pra um dado corrompido nao quebrar o rodape inteiro.
function parseExtraLinks(raw: string | undefined): StoreLink[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is StoreLink =>
        item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.url === 'string',
    )
  } catch {
    return []
  }
}

// Escurece uma cor hex em `amount` (0 a 1), usado para gerar a variante
// "dark" da cor primaria (ex.: hover de botoes) sem o lojista precisar
// configurar uma segunda cor. Hex invalido devolve a cor original sem mudanca.
function darken(hex: string, amount: number): string {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex
  const num = parseInt(normalized, 16)
  const channel = (shift: number) => {
    const value = Math.round(((num >> shift) & 255) * (1 - amount))
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
  }
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

// Evita carregar a mesma fonte do Google mais de uma vez por sessao.
const loadedFonts = new Set<string>()

// Injeta a tag <link> do Google Fonts para uma fonte, se ainda nao tiver
// sido carregada (nem nesta sessao, nem por um <link> ja presente no DOM).
function ensureGoogleFont(fontName: string) {
  if (loadedFonts.has(fontName)) return
  loadedFonts.add(fontName)
  if (document.querySelector(`link[data-theme-font="${fontName}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.dataset.themeFont = fontName
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}

// Troca o favicon da pagina pela URL configurada, criando a tag <link rel="icon">
// se o documento ainda nao tiver uma.
function setFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}

/** Aplica o tema como variaveis CSS em :root - e o que faz o site inteiro
 * reagir, tanto na pre-visualizacao ao vivo das Configuracoes quanto na
 * aplicacao automatica no load (ver useStoreTheme abaixo). */
export function applyStoreTheme(theme: StoreTheme) {
  const root = document.documentElement.style
  root.setProperty('--color-primary', theme.colorPrimary)
  root.setProperty('--color-primary-dark', darken(theme.colorPrimary, 0.22))
  root.setProperty('--color-accent', theme.colorAccent)
  root.setProperty('--color-icon', theme.iconColor)
  root.setProperty('--color-bg', theme.colorBg)
  root.setProperty('--color-success', theme.colorSuccess)
  root.setProperty('--color-error', theme.colorError)
  root.setProperty('--radius-button', BUTTON_RADIUS_PX[theme.buttonRadius])
  root.setProperty('--radius-window', WINDOW_RADIUS_PX[theme.windowRadius])
  root.setProperty(
    '--shadow-window',
    `0 24px 60px -28px color-mix(in srgb, var(--color-primary) ${WINDOW_SHADOW_STRENGTH[theme.windowShadow]}, black)`,
  )
  root.setProperty('--space-unit', DENSITY_SCALE[theme.density])
  root.setProperty('--font-heading', `'${theme.fontHeading}'`)
  root.setProperty('--font-body', `'${theme.fontBody}'`)
  ensureGoogleFont(theme.fontHeading)
  ensureGoogleFont(theme.fontBody)
  if (theme.faviconUrl) setFavicon(theme.faviconUrl)
  document.title = theme.storeName || document.title
}

// Promise compartilhada entre todas as instancias do hook - garante que a
// config da loja seja buscada uma unica vez, mesmo com varios componentes
// chamando useStoreTheme ao mesmo tempo.
let themePromise: Promise<StoreTheme> | null = null

function fetchStoreTheme(): Promise<StoreTheme> {
  if (!themePromise) {
    themePromise = api
      .get<{ theme?: RawThemeSettings }>('/store/config')
      .then((config) => parseTheme(config.theme))
      .catch(() => DEFAULT_STORE_THEME)
  }
  return themePromise
}

/** Tema da loja configurado em Configuracoes > Aparencia. Busca uma vez (promise
 * compartilhada entre instancias, igual useStoreWhatsapp) e ja aplica como
 * variaveis CSS - qualquer componente pode so ler os campos (ex. storeName)
 * sem se preocupar em aplicar nada. */
export function useStoreTheme(): StoreTheme & { loading: boolean } {
  const [theme, setTheme] = useState<StoreTheme>(DEFAULT_STORE_THEME)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchStoreTheme().then((value) => {
      if (cancelled) return
      setTheme(value)
      applyStoreTheme(value)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...theme, loading }
}
