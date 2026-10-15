import {
  Bell,
  CreditCard,
  FileText,
  Heart,
  Home,
  Menu,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Tag,
  Target,
  ThumbsUp,
  User,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import atendimentoIcon from '../../../assets/icons/atendente_d_c.png'
import favoritoIcon from '../../../assets/icons/coracoes_d_c.png'
import { NotificationsDrawer } from '../../../components/notifications/NotificationsDrawer'
import { useAuth } from '../../../contexts/AuthContext'
import { useAdminNotifications } from '../../../hooks/useAdminNotifications'
import { useOrganizerStore } from '../../../hooks/useOrganizerStore'
import { useStoreWhatsapp } from '../../../hooks/useStoreWhatsapp'
import { useStoreTheme } from '../../../hooks/useStoreTheme'
import {
  isOrganizerNodeAvailable,
  isOrganizerPreviewMode,
  withOrganizerPreview,
} from '../../../types/organizer'
import { Carousel } from '../../../components/Carousel'

// Listas estaticas de itens exibidos no menu gaveta (drawer) do mobile,
// separadas em secoes: atalhos, conta e descoberta de produtos.
const shortcutLinks: { label: string; icon: LucideIcon }[] = [
  { label: 'Cupons', icon: Tag },
  { label: 'Mais vendido', icon: ShoppingBag },
]

const accountLinks: { label: string; icon: LucideIcon }[] = [
  { label: 'Minha conta', icon: Home },
  { label: 'Meus dados', icon: User },
  { label: 'Meus pedidos', icon: ShoppingBasket },
  { label: 'Carteira', icon: CreditCard },
  { label: 'Avaliacao', icon: ThumbsUp },
  { label: 'Protocolo', icon: FileText },
  { label: 'Favorito', icon: Heart },
]

const discoveryLinks: { label: string; icon: LucideIcon }[] = [
  { label: 'Mais procurado', icon: Target },
  { label: 'Acabaram de chegar', icon: Zap },
]

// Linha simples de icone + texto, usada pra renderizar cada item das listas
// acima dentro do drawer mobile.
function DrawerRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 text-[#fafaf8]">
      <Icon size={20} className="shrink-0" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

// Header da versao mobile: barra superior com menu/logo/busca/whatsapp,
// linha de atalhos de categoria, e o drawer lateral de navegacao/conta.
export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { isCustomer, isAdmin, token, openAuth, requireAuth } = useAuth()
  const { store } = useOrganizerStore()
  const storeWhatsapp = useStoreWhatsapp()
  const { storeName, logoUrl } = useStoreTheme()
  const { unread, notifications, loading, loadNotifications, markRead } = useAdminNotifications(
    isAdmin,
    token,
  )
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  // Modo preview do Organizador: mantem esse parametro propagado nos links
  // internos pra nao perder o preview ao navegar pelo header
  const previewMode = isOrganizerPreviewMode(location.search)
  const homePath = withOrganizerPreview('/', previewMode)
  const currentPath = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/'
  // Monta os links de categoria/pagina a partir das paginas cadastradas no
  // Organizador, excluindo a home e a pagina atual, respeitando o preview.
  const categoryLinks = store.nodes
    .filter(
      (node) =>
        node.type === 'page' &&
        node.id !== 'home' &&
        node.route &&
        isOrganizerNodeAvailable(node, previewMode) &&
        (node.route.length > 1 ? node.route.replace(/\/+$/, '') : '/') !== currentPath,
    )
    .map((node) => ({
      label: node.name,
      path: withOrganizerPreview(node.route as string, previewMode),
    }))

  useEffect(() => {
    // Limiares diferentes pra recolher (40) e pra expandir de volta (8): com
    // um unico valor, parar de rolar bem no limiar fica trocando de estado
    // sem parar (o menu "treme" abrindo e fechando).
    const onScroll = () => setScrolled((current) => (current ? window.scrollY > 8 : window.scrollY > 40))
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Marca o body quando o drawer esta aberto (provavelmente usado em CSS
  // global pra travar o scroll da pagina de fundo).
  useEffect(() => {
    document.body.classList.toggle('drawer-open', open)
    return () => document.body.classList.remove('drawer-open')
  }, [open])

  // Busca ainda nao filtra de verdade: so limpa o campo e manda pra home
  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchTerm('')
    navigate(homePath)
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-primary-dark)]/40 bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-dark)_100%)]">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-3">
          <div className="flex items-center justify-start">
            <button
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((value) => !value)}
              className="flex items-center justify-center text-[color:var(--color-icon)]"
            >
              {open ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>

          {/* Logo e campo de busca ocupam o mesmo espaco: um fade/translada
              pro lugar do outro conforme rola a pagina (scrolled) */}
          <div className="relative flex h-9 items-center justify-center overflow-hidden">
            <Link
              to={homePath}
              className={[
                'flex flex-col items-center text-center transition-all duration-300 ease-in-out',
                scrolled ? 'pointer-events-none -translate-y-3 opacity-0' : 'translate-y-0 opacity-100',
              ].join(' ')}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="h-6 w-auto max-w-[120px] object-contain" />
              ) : (
                <span className="block whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF6EF]">
                  {storeName}
                </span>
              )}
            </Link>

            <form
              onSubmit={handleSearchSubmit}
              className={[
                'absolute inset-0 flex w-full items-center gap-1.5 rounded-[16px] bg-[#FAF6EF] py-1.5 pl-3 pr-1 transition-all duration-300 ease-in-out',
                scrolled ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
              ].join(' ')}
            >
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar produtos, marcas..."
                className="w-full bg-transparent text-xs text-[#2a0f3d] outline-none placeholder:text-[#6b665f]"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#2a0f3d] ring-1 ring-inset ring-[#2a0f3d]/10"
              >
                <Search size={12} />
              </button>
            </form>
          </div>

          <div className="flex items-center justify-end gap-2">
            <>
              <a
                href={`https://wa.me/${storeWhatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Atendimento via WhatsApp"
                className="flex shrink-0 items-center"
              >
                <img
                  src={atendimentoIcon}
                  alt=""
                  aria-hidden="true"
                  className="h-9 w-9 shrink-0 object-contain"
                />
              </a>
              <button
                type="button"
                aria-label="Favoritos"
                onClick={() =>
                  requireAuth(() => navigate('/conta'), 'Entre ou cadastre-se para salvar seus favoritos.')
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center text-[#fafaf8]"
              >
                <img src={favoritoIcon} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
              </button>
            </>
          </div>
        </div>

        {/* Barra de busca "expandida" + atalhos de categoria: encolhe quando
            a pagina rola ou o drawer abre, pra nao competir com eles */}
        <div
          className={[
            'overflow-hidden transition-all duration-300 ease-in-out',
            scrolled || open ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100',
          ].join(' ')}
        >
          <div className="px-4 pb-3">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2 rounded-[20px] bg-[#FAF6EF] py-2 pl-4 pr-2"
            >
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar produtos, marcas..."
                className="w-full bg-transparent text-sm text-[#2a0f3d] outline-none placeholder:text-[#6b665f]"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[20px] bg-white text-[#2a0f3d] ring-1 ring-inset ring-[#2a0f3d]/10"
              >
                <Search size={16} />
              </button>
            </form>

            {/* Carrossel horizontal com as paginas/categorias cadastradas no Organizador */}
            <nav aria-label="Categorias" className="mt-3">
              <Carousel
                ariaLabel="Categorias de produtos"
                items={categoryLinks}
                getItemKey={(category) => category.path}
                itemClassName="min-w-[88px] shrink-0 text-center"
                className="gap-5 px-4 whitespace-nowrap"
                renderItem={(category) => (
                  <Link
                    to={category.path}
                    className="block text-sm font-medium text-[#FAF6EF]/70 hover:text-[#FAF6EF]"
                  >
                    {category.label}
                  </Link>
                )}
              />
            </nav>
          </div>
        </div>

        {/* Drawer lateral de navegacao: cobre a tela toda abaixo do header,
            so fica visivel (opacity-100) quando `open` esta ativo */}
        <div
          className={[
            'fixed inset-x-0 top-[61px] bottom-0 z-20 border-t border-[color:var(--color-primary-dark)]/40 bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-dark)_100%)] transition-opacity duration-300 ease-in-out',
            open ? 'opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
        >
          <div className="h-full overflow-y-auto px-4 pb-24 pt-5">
            <>
              {/* Primeira linha do drawer: leva pra conta se ja estiver
                  logado, ou abre o modal de autenticacao senao */}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (isCustomer) {
                    navigate('/conta')
                    return
                  }
                  openAuth({ reason: 'Entre ou cadastre-se para acessar sua conta.' })
                }}
                className="flex w-full items-center gap-3 pb-4 text-left text-[#fafaf8]"
              >
                <User size={22} className="shrink-0" />
                <span className="text-sm font-semibold">
                  {isCustomer ? 'Minha conta' : 'Ola. Acesse sua conta'}
                </span>
              </button>

              <div className="flex flex-col gap-4 pb-4">
                {shortcutLinks.map((item) => (
                  <DrawerRow key={item.label} {...item} />
                ))}
              </div>

              <div className="h-px bg-[color:var(--color-accent)]" />

              <div className="flex flex-col gap-4 py-4">
                {accountLinks.map((item) => (
                  <DrawerRow key={item.label} {...item} />
                ))}
                {/* Item de notificacoes só aparece pra admin, com badge de nao lidas */}
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setNotificationsOpen(true)
                    }}
                    className="flex items-center justify-between gap-3 text-left"
                  >
                    <DrawerRow icon={Bell} label="Notificações" />
                    {unread > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-accent)] px-1.5 text-[10px] font-bold text-[color:var(--color-primary-dark)]">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    ) : null}
                  </button>
                ) : null}
              </div>

              <div className="h-px bg-[color:var(--color-accent)]" />

              <div className="flex flex-col gap-4 pt-4 pb-6">
                {discoveryLinks.map((item) => (
                  <DrawerRow key={item.label} {...item} />
                ))}
              </div>

              {/* Botoes de entrar/cadastro no rodape do drawer, sempre visiveis
                  independente do estado de login (reforcam o CTA) */}
              <div className="mt-[5px] flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    openAuth({ reason: 'Entre ou cadastre-se para acessar sua conta.' })
                  }}
                  className="w-full max-w-[240px] rounded-[var(--radius-button)] bg-[color-mix(in_srgb,var(--color-accent)_22%,white)] py-3 text-center text-sm font-semibold text-[#2a0f3d]"
                >
                  Entre
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    openAuth({ view: 'register', reason: 'Preencha sua ficha de cadastro.' })
                  }}
                  className="text-sm font-semibold text-[#fafaf8]"
                >
                  Cadastro
                </button>
              </div>
            </>
          </div>
        </div>
      </header>

      {/* Overlay invisivel pra fechar o drawer ao clicar fora dele */}
      {open ? <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-20" /> : null}

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
    </>
  )
}
