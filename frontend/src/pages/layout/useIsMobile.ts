import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 767px)'

// Hook compartilhado que diz se a tela atual é mobile (usado pelo Header,
// MainLayout etc pra escolher entre layout desktop e mobile).
export function useIsMobile() {
  // Estado inicial já calculado via matchMedia pra evitar flash trocando de
  // layout logo apos o primeiro render (SSR/sem window cai como false).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_QUERY).matches,
  )

  // Escuta mudanças de viewport (redimensionar janela, rotacionar device) e
  // mantem o estado sincronizado com a media query.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
