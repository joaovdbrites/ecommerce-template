import { DesktopHeader } from './desktop/DesktopHeader'
import { MobileHeader } from './mobile/MobileHeader'
import { useIsMobile } from './useIsMobile'

export function Header() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileHeader /> : <DesktopHeader />
}
