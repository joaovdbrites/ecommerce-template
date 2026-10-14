import { useCallback, useEffect, useRef, useState } from 'react'
import { useGoogleClientId } from './useGoogleClientId'

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string
        callback: (response: { credential?: string }) => void
        cancel_on_tap_outside?: boolean
      }) => void
      renderButton: (
        parent: HTMLElement,
        options: {
          type?: 'standard' | 'icon'
          theme?: 'outline' | 'filled_blue' | 'filled_black'
          size?: 'small' | 'medium' | 'large'
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape?: 'rectangular' | 'pill' | 'circle' | 'square'
          logo_alignment?: 'left' | 'center'
          width?: number
          locale?: string
        },
      ) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityServices
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const SCRIPT_TIMEOUT_MS = 8000
let scriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true

    // Rede corporativa, bloqueador de anuncios ou o Google fora do ar deixam a
    // requisicao pendurada sem disparar 'error'. Sem este prazo o cliente fica
    // olhando um espaco vazio sem saber que o botao nao vem.
    const timeout = window.setTimeout(() => {
      scriptPromise = null
      reject(new Error('Tempo esgotado ao carregar o login do Google'))
    }, SCRIPT_TIMEOUT_MS)

    script.addEventListener('load', () => {
      window.clearTimeout(timeout)
      resolve()
    })
    script.addEventListener('error', () => {
      window.clearTimeout(timeout)
      scriptPromise = null
      reject(new Error('Nao foi possivel carregar o login do Google'))
    })
    if (!existing) document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * Botao oficial do Google Identity Services. Quem decide exibir a secao e o
 * AuthModal, via useGoogleClientId: sem credencial nada aparece.
 */
export function GoogleSignInButton({
  onCredential,
  disabled = false,
}: {
  onCredential: (credential: string) => void
  disabled?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onCredential)
  const [failed, setFailed] = useState(false)
  const clientId = useGoogleClientId()
  // O botao oficial do Google so aceita largura em pixels, entao medimos o
  // container para ele acompanhar a janela em vez de ficar fixo no meio.
  const [width, setWidth] = useState(0)

  // A medida inicial sai do proprio ref, assim que o container entra no DOM.
  // Depender do ResizeObserver para a primeira medida nao funciona: em alguns
  // navegadores ele nao dispara para um elemento de altura zero, e o botao
  // ficava sem largura - ou seja, nunca renderizava.
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    container.current = node
    if (node) setWidth(node.offsetWidth)
  }, [])

  // O observer fica so para mudancas depois da montagem (girar o celular,
  // redimensionar a janela).
  useEffect(() => {
    const node = container.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [clientId])

  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!clientId || width === 0) return
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential)
          },
          cancel_on_tap_outside: true,
        })
        container.current.innerHTML = ''
        window.google.accounts.id.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          // O Google limita o botao a 400px.
          width: Math.min(Math.max(width, 200), 400),
          locale: 'pt-BR',
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [clientId, width])

  // Sem credencial a secao inteira nem e renderizada pelo AuthModal; aqui so
  // sobra o caso de o script do Google nao ter carregado.
  if (!clientId || failed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-stone-300 bg-stone-50 px-6 py-3 text-sm font-semibold text-stone-400">
          <GoogleGlyph muted />
          Continuar com Google
        </span>
        <p className="text-center text-xs text-[#8b847b]">
          Nao foi possivel carregar o login do Google agora.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={attachContainer}
      className={`flex w-full justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    />
  )
}

function GoogleGlyph({ muted = false }: { muted?: boolean }) {
  if (muted) {
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="currentColor"
          d="M44.5 20H24v8.5h11.8C34.7 33.7 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.3 3l6-6C34.6 4.9 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.2-2.7-.5-4z"
        />
      </svg>
    )
  }

  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.5h12.1c-.2 2-1.6 5-4.5 7l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15.7z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10l7.1-5.5z"
      />
      <path
        fill="#EA4335"
        d="M24 10.6c3.3 0 6.1 1.1 8.4 3.3l6.1-6.1C34.9 4.2 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14l7.1 5.5c1.8-5.3 6.7-8.9 12.5-8.9z"
      />
    </svg>
  )
}
