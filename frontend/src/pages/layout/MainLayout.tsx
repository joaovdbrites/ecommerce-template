import { Outlet, useLocation } from 'react-router-dom'
import { AuthModal } from '../../components/auth/AuthModal'
import { Footer } from '../../components/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { Header } from './Header'
import { MobileBottomNav } from './mobile/MobileBottomNav'
import { useIsMobile } from './useIsMobile'

export function MainLayout() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const { modal } = useAuth()
  const isStandaloneProductPage = location.pathname === '/admin'

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip text-stone-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(216,154,40,0.12),_transparent_30%),linear-gradient(180deg,_#f8f5f9_0%,_#eadcf0_45%,_#f8f5f9_100%)]" />
      <div
        aria-hidden="true"
        className="mesh-field pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_18%_18%,_rgba(216,154,40,0.15),_transparent_28%),radial-gradient(circle_at_82%_0%,_rgba(91,36,127,0.1),_transparent_30%)]"
      />
      {isStandaloneProductPage ? null : <Header />}
      <div
        className={
          isStandaloneProductPage
            ? 'w-full flex-1'
            : `w-full flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:px-8 xl:px-6 ${isMobile ? 'pb-24' : ''}`
        }
      >
        <main key={location.pathname} className={isStandaloneProductPage ? '' : 'page-enter'}>
          <Outlet />
        </main>
      </div>
      {isStandaloneProductPage ? null : <Footer />}
      {isMobile && !isStandaloneProductPage ? <MobileBottomNav /> : null}
      {/* A chave remonta a janela zerada a cada nova abertura. */}
      {modal ? <AuthModal key={modal.id} /> : null}
    </div>
  )
}
