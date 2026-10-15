import { Bell, LayoutDashboard, LogOut, MapPin, Search, User, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import atendimentoIcon from '../../../assets/icons/atendente_d_c.png'
import favoritoIcon from '../../../assets/icons/coracoes_d_c.png'
import pedidosIcon from '../../../assets/icons/catalogo_d_c.png'
import sacolaIcon from '../../../assets/icons/sacola_d_c.png'
import { NotificationsDrawer } from '../../../components/notifications/NotificationsDrawer'
import { useAuth } from '../../../contexts/AuthContext'
import { useCart } from '../../../contexts/CartContext'
import { useAdminNotifications } from '../../../hooks/useAdminNotifications'
import { useOrganizerStore } from '../../../hooks/useOrganizerStore'
import { useStoreWhatsapp } from '../../../hooks/useStoreWhatsapp'
import { useStoreTheme } from '../../../hooks/useStoreTheme'
import {
  isOrganizerNodeAvailable,
  isOrganizerPreviewMode,
  withOrganizerPreview,
} from '../../../types/organizer'
import { Button } from '../../../components/Button'

// Header fixo da versao desktop: logo, busca, navegacao dinamica das paginas
// do Organizador, menu da conta e os atalhos de pedidos/whatsapp/favoritos/carrinho.
export function DesktopHeader() {
  const { items } = useCart()
  const { scope, token, openAuth, requireAuth, isAdmin, logout } = useAuth()
  const { store } = useOrganizerStore()
  const storeWhatsapp = useStoreWhatsapp()
  const { storeName, logoUrl } = useStoreTheme()
  // Notificacoes de admin (so carregam/fazem sentido quando isAdmin é true)
  const { unread, notifications, loading, loadNotifications, markRead } = useAdminNotifications(
    isAdmin,
    token,
  )
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const isCustomer = scope === 'customer'
  // Controla o header "encolhido" (esconde a barra de paginas) ao rolar a pagina
  const [scrolled, setScrolled] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  // Total de itens no carrinho, mostrado como badge no icone da sacola
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const navigate = useNavigate()
  const location = useLocation()
  // Modo preview do Organizador: mantem esse parametro propagado nos links
  // internos pra nao perder o preview ao navegar pelo header
  const previewMode = isOrganizerPreviewMode(location.search)
  const homePath = withOrganizerPreview('/', previewMode)
  const currentPath = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/'

  useEffect(() => {
    // Limiares diferentes pra recolher (40) e pra expandir de volta (8): com
    // um unico valor, parar de rolar bem no limiar fica trocando de estado
    // sem parar (o menu "treme" abrindo e fechando).
    const onScroll = () => setScrolled((current) => (current ? window.scrollY > 8 : window.scrollY > 40))
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Busca ainda nao filtra de verdade: so limpa o campo e manda pra home
  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchTerm('')
    navigate(homePath)
  }

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    [
      'relative text-sm font-medium after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-[color:var(--color-accent)] after:transition-transform hover:after:scale-x-100',
      `text-[#FAF6EF]/70 hover:text-[#FAF6EF] ${isActive ? 'text-[#FAF6EF] after:scale-x-100' : ''}`,
    ].join(' ')

  // Monta a lista de links de navegacao a partir das paginas cadastradas no
  // Organizador, filtrando a pagina atual (nao faz sentido linkar pra onde ja esta)
  // e respeitando o modo preview (paginas ainda nao publicadas).
  const customerLinks = store.nodes
    .filter((node) => {
      if (node.type !== 'page' || !node.route || !isOrganizerNodeAvailable(node, previewMode)) return false
      const nodePath = node.route.length > 1 ? node.route.replace(/\/+$/, '') : '/'
      return nodePath !== currentPath
    })
    .map((node) => ({
      id: node.id,
      label: node.id === 'home' ? 'Início' : node.name,
      path: withOrganizerPreview(node.route as string, previewMode),
    }))

  return (
    <header
      className={[
        'sticky top-0 z-30 border-b bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-dark)_100%)] transition duration-300',
        scrolled
          ? 'border-[color:var(--color-primary)]/40 shadow-[0_18px_40px_-30px_color-mix(in_srgb,var(--color-primary)_70%,black)]'
          : 'border-[color:var(--color-primary-dark)]/40',
      ].join(' ')}
    >
      {/* overflow-hidden so na camada decorativa: o menu da conta (que fica
          num descendente dessa <header>) precisa poder "vazar" por baixo dela
          sem ser cortado. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 130 100"
          className="absolute -right-4 -top-6 z-0 h-[160px] w-[208px] opacity-10"
        >
          <path
            d="M55 10 h20 v14 l10 10 v56 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4 v-56 l10 -10 z"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
          />
        </svg>
      </div>

      <div className="relative z-10 px-6 py-4">
        <div className="flex w-full items-center gap-4 xl:gap-6">
          <Link
            to={homePath}
            className="flex shrink-0 flex-col justify-center space-y-1.5 self-center rounded-[20px] lg:px-1 xl:px-5"
          >
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              <span className="block whitespace-nowrap text-base font-semibold uppercase tracking-[0.28em] text-[#FAF6EF] lg:text-lg lg:tracking-[0.38em]">
                {storeName}
              </span>
            )}
          </Link>

          <form
            onSubmit={handleSearchSubmit}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-[20px] bg-[#FAF6EF] py-1.5 pl-4 pr-1.5"
          >
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar produtos, marcas..."
              className="w-full min-w-0 bg-transparent text-sm text-[#2a0f3d] outline-none placeholder:text-[#6b665f]"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[20px] bg-[#FAF6EF] text-[#2a0f3d] ring-1 ring-inset ring-[#2a0f3d]/10 transition hover:bg-white"
            >
              <Search size={16} />
            </button>
          </form>

          <div className="flex shrink-0 items-center gap-1 lg:gap-2 xl:gap-3">
            <div className="relative flex items-center rounded-[20px] lg:px-1 xl:px-4">
              {/* Cliente logado ve o botao "Minha conta" com dropdown; visitante ve "Entrar" */}
              {isCustomer ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={accountMenuOpen ? 'Fechar menu da conta' : 'Abrir menu da conta'}
                    aria-expanded={accountMenuOpen}
                    onClick={() => setAccountMenuOpen((value) => !value)}
                  >
                    <User size={16} />
                    <span>Minha conta</span>
                  </Button>

                  {/* Sempre no DOM: a transicao de escala (origin no topo, "de
                      cima para baixo") so anima trocando classe, nao
                      montando/desmontando - igual a versao mobile. */}
                  <div
                    role="menu"
                    aria-label="Menu da conta"
                    className={`absolute right-0 top-full z-40 mt-2 w-52 origin-top overflow-hidden rounded-[18px] border border-[color:var(--color-primary-dark)]/40 bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-dark)_100%)] shadow-[0_20px_50px_-15px_rgba(42,15,61,0.6)] transition-[transform,opacity] duration-200 ease-out ${
                      accountMenuOpen ? 'scale-y-100 opacity-100' : 'pointer-events-none scale-y-0 opacity-0'
                    }`}
                  >
                    <AccountMenuItem
                      icon={<UserRound size={16} />}
                      label="Meus dados"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        navigate('/conta?tab=profile')
                      }}
                    />
                    <AccountMenuItem
                      icon={<MapPin size={16} />}
                      label="Enderecos"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        navigate('/conta?tab=addresses')
                      }}
                    />
                    {/* Atalho pro painel do Organizador, só pra quem é admin */}
                    {isAdmin ? (
                      <AccountMenuItem
                        icon={<LayoutDashboard size={16} />}
                        label="Editor"
                        onClick={() => {
                          setAccountMenuOpen(false)
                          navigate('/admin')
                        }}
                      />
                    ) : null}
                    <div className="h-px bg-[#fafaf8]/15" />
                    <AccountMenuItem
                      icon={<LogOut size={16} />}
                      label="Sair"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        logout()
                        navigate('/')
                      }}
                    />
                  </div>

                  {/* Overlay invisivel pra fechar o menu ao clicar fora dele */}
                  {accountMenuOpen ? (
                    <div
                      aria-hidden="true"
                      onClick={() => setAccountMenuOpen(false)}
                      className="fixed inset-0 z-30"
                    />
                  ) : null}
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Entrar"
                  onClick={() => openAuth({ reason: 'Entre ou cadastre-se para acompanhar seus pedidos.' })}
                >
                  Entrar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-[20px] lg:gap-2 lg:px-1 xl:gap-3 xl:px-3">
              {/* Sino de notificacoes so aparece pra admin */}
              {isAdmin ? (
                <button
                  type="button"
                  aria-label={notificationsOpen ? 'Fechar notificações' : 'Abrir notificações'}
                  onClick={() => setNotificationsOpen((value) => !value)}
                  className="group relative inline-flex shrink-0 items-center"
                >
                  <Bell
                    strokeWidth={1.5}
                    className="h-6 w-6 shrink-0 text-[color:var(--color-icon)] lg:h-7 lg:w-7 xl:h-8 xl:w-8"
                  />
                  {unread > 0 ? (
                    <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-accent)] px-1 text-[9px] font-bold text-[color:var(--color-primary-dark)]">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : null}
                  <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                    Notificações
                  </span>
                </button>
              ) : null}
              <Link
                to="/pedidos"
                aria-label="Pedidos"
                className="group relative inline-flex shrink-0 items-center"
              >
                <img
                  src={pedidosIcon}
                  alt=""
                  className="h-9 w-9 shrink-0 object-contain lg:h-11 lg:w-11 xl:h-[50px] xl:w-[50px]"
                />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                  Pedidos
                </span>
              </Link>
              <a
                href={`https://wa.me/${storeWhatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Atendimento via WhatsApp"
                className="group relative flex shrink-0 items-center"
              >
                <img
                  src={atendimentoIcon}
                  alt=""
                  className="h-9 w-9 shrink-0 lg:h-11 lg:w-11 xl:h-[50px] xl:w-[50px]"
                />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                  Atendimento
                </span>
              </a>
              <button
                type="button"
                aria-label="Favoritos"
                onClick={() =>
                  requireAuth(() => navigate('/conta'), 'Entre ou cadastre-se para salvar seus favoritos.')
                }
                className="group relative inline-flex shrink-0 items-center"
              >
                <img
                  src={favoritoIcon}
                  alt=""
                  className="h-9 w-9 shrink-0 object-contain lg:h-11 lg:w-11 xl:h-[50px] xl:w-[50px]"
                />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                  Favoritos
                </span>
              </button>
              <Link
                to="/checkout"
                aria-label="Carrinho"
                className="group relative inline-flex shrink-0 items-center"
              >
                <img
                  src={sacolaIcon}
                  alt=""
                  className="h-9 w-9 shrink-0 lg:h-11 lg:w-11 xl:h-[50px] xl:w-[50px]"
                />
                <span className="pointer-events-none absolute -right-1 -top-1 text-xs font-bold text-white">
                  {count}
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                  Carrinho
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Barra com os links das paginas do site: encolhe (max-h-0) quando
            scrolled, dando lugar a um header mais compacto */}
        <div
          className={[
            'overflow-hidden transition-all duration-300 ease-in-out',
            scrolled ? 'max-h-0 opacity-0' : 'max-h-16 opacity-100',
          ].join(' ')}
        >
          <nav
            aria-label="Páginas do site"
            className="mt-6 flex w-full items-center justify-center gap-4 overflow-x-auto whitespace-nowrap [scrollbar-width:none] xl:gap-6 [&::-webkit-scrollbar]:hidden"
          >
            {customerLinks.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => `${navLinkClassName({ isActive })} shrink-0`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Gaveta lateral com a lista de notificacoes, só montada pra admin */}
      {isAdmin ? (
        <NotificationsDrawer
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          loading={loading}
          loadNotifications={loadNotifications}
          markRead={markRead}
        />
      ) : null}
    </header>
  )
}

// Item de linha reutilizado dentro do dropdown "Minha conta" (icone + label)
function AccountMenuItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-[#fafaf8] transition hover:bg-white/10"
    >
      {icon}
      {label}
    </button>
  )
}
