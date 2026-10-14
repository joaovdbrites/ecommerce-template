import { LayoutDashboard, LogOut, MapPin, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import pedidosIcon from '../../../assets/icons/catalogo_d_c.png'
import homeIcon from '../../../assets/icons/home_d_c.png'
import perfilIcon from '../../../assets/icons/perfil_d_c.png'
import sacolaIcon from '../../../assets/icons/sacola_d_c.png'
import { useAuth } from '../../../contexts/AuthContext'
import { useCart } from '../../../contexts/CartContext'

export function MobileBottomNav() {
  const { scope, requireAuth, isAdmin, logout } = useAuth()
  const { items } = useCart()
  const navigate = useNavigate()
  const isCustomer = scope === 'customer'
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const itemClassName = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
      isActive ? 'text-[#fafaf8]' : 'text-[#fafaf8]/70'
    }`

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-[#3a164f]/40 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)]">
      <NavLink to="/" end className={itemClassName}>
        <img src={homeIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        Home
      </NavLink>
      <NavLink to="/pedidos" className={itemClassName}>
        <img src={pedidosIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        Pedidos
      </NavLink>
      <NavLink to="/checkout" className={itemClassName}>
        <span className="relative flex items-center justify-center">
          <img src={sacolaIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#d89a28] text-[8px] font-bold text-[#3a164f]">
            {count}
          </span>
        </span>
        Sacola
      </NavLink>
      {isCustomer ? (
        <div className="relative flex flex-1">
          <button
            type="button"
            aria-label={accountMenuOpen ? 'Fechar menu da conta' : 'Abrir menu da conta'}
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((value) => !value)}
            className={itemClassName({ isActive: accountMenuOpen })}
          >
            <img src={perfilIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            Minha conta
          </button>

          {/* Sempre no DOM: a transicao de escala (origin no topo, "de cima para
              baixo") so anima trocando classe, nao montando/desmontando. */}
          <div
            role="menu"
            aria-label="Menu da conta"
            className={`absolute bottom-full right-0 z-40 mb-2 w-52 origin-top overflow-hidden rounded-[18px] border border-[#3a164f]/40 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] shadow-[0_20px_50px_-15px_rgba(42,15,61,0.6)] transition-[transform,opacity] duration-200 ease-out ${
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
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            requireAuth(() => navigate('/conta'), 'Entre ou cadastre-se para acessar sua conta.')
          }
          className={itemClassName({ isActive: false })}
        >
          <img src={perfilIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
          Minha conta
        </button>
      )}

      {accountMenuOpen ? (
        <div aria-hidden="true" onClick={() => setAccountMenuOpen(false)} className="fixed inset-0 z-30" />
      ) : null}
    </nav>
  )
}

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
