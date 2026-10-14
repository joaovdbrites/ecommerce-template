import { useEffect, useState } from 'react'
import { api } from '../services/api'

export type ButtonRadiusPreset = 'square' | 'rounded' | 'pill'
export type WindowRadiusPreset = 'square' | 'rounded' | 'xl'
export type WindowShadowPreset = 'soft' | 'medium' | 'strong'
export type DensityPreset = 'compact' | 'comfortable' | 'spacious'

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
}

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
}

export const HEADING_FONT_OPTIONS = ['Cormorant Garamond', 'Playfair Display', 'Merriweather', 'Lora', 'Poppins']
export const BODY_FONT_OPTIONS = ['Montserrat', 'Inter', 'Manrope', 'Roboto', 'Open Sans']

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
  }
}

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

const loadedFonts = new Set<string>()

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
