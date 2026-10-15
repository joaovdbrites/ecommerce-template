import { DesktopHeader } from './desktop/DesktopHeader'
import { MobileHeader } from './mobile/MobileHeader'
import { useIsMobile } from './useIsMobile'

// Header "roteador": so decide qual variante renderizar (mobile ou desktop),
// cada uma com sua propria estrutura de navegacao.
export function Header() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileHeader /> : <DesktopHeader />
}
