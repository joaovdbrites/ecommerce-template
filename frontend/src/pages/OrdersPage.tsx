import { ChevronRight, Package, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { CustomerOrder } from '../types'
import { formatOrderDate, getOrderStatusPresentation } from '../utils/orders'

type OrdersProfile = {
  orders: CustomerOrder[]
}

// Pagina "Meus pedidos": lista todos os pedidos do cliente logado, cada um
// linkando pro detalhe/acompanhamento (/pedidos/:id).
export function OrdersPage() {
  const { token, scope } = useAuth()
  const format = useCurrency()
  // null = ainda carregando, [] = carregou e nao tem pedidos
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null)

  // Busca o perfil do cliente (que inclui os pedidos) assim que houver um
  // token de cliente valido; ignora o resultado se o efeito for desmontado
  // antes da resposta chegar (evita setState em componente desmontado).
  useEffect(() => {
    if (!token || scope !== 'customer') return

    let ignoreResult = false
    api
      .get<OrdersProfile>('/customer/me', token)
      .then((profile) => {
        if (!ignoreResult) setOrders(profile.orders)
      })
      .catch(() => {
        if (!ignoreResult) setOrders([])
      })

    return () => {
      ignoreResult = true
    }
  }, [token, scope])

  // Sem sessao de cliente valida, trata como lista vazia (nao mostra skeleton pra sempre)
  const visibleOrders = token && scope === 'customer' ? orders : []

  // Ainda buscando os pedidos: mostra placeholder de carregamento
  if (!visibleOrders) {
    return <Skeleton className="h-[380px] w-full rounded-[36px]" />
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Reveal>
        <section className="surface-panel p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Minha conta</p>
              <h1 className="mt-3 text-5xl leading-none text-[#2a0f3d]">Pedidos</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#6b665f]">
                Consulte os itens, pagamento, entrega e o andamento de cada compra.
              </p>
            </div>
            <Link to="/" className="text-sm font-semibold text-[#b77717] hover:text-[#b77717]">
              Voltar ao início
            </Link>
          </div>
        </section>
      </Reveal>

      {/* Cliente sem nenhum pedido ainda ve um estado vazio em vez da lista */}
      {visibleOrders.length === 0 ? (
        <EmptyState
          eyebrow="Pedidos"
          title="Você ainda não fez nenhum pedido"
          description="Quando uma compra for concluída, ela aparecerá aqui com o status e os detalhes."
        />
      ) : (
        <section className="space-y-4" aria-label="Lista de pedidos">
          {visibleOrders.map((order, index) => {
            const status = getOrderStatusPresentation(order)
            return (
              <Reveal key={order.id} delay={Math.min(index * 45, 180)}>
                <Link
                  to={`/pedidos/${order.id}`}
                  className="group block overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_20px_45px_-36px_rgba(23,20,18,0.45)] transition hover:-translate-y-0.5 hover:border-[#d89a28]/60 hover:shadow-[0_24px_48px_-32px_rgba(216,154,40,0.42)]"
                >
                  <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b77717]">
                        {index === 0 ? 'Resumo do seu último pedido' : 'Pedido'}
                      </p>
                      <p className="mt-1 text-sm text-[#6b665f]">
                        Pedido <span className="font-semibold text-[#2a0f3d]">#{order.id.slice(0, 8)}</span> ·{' '}
                        {formatOrderDate(order.createdAt)}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-semibold text-[#b77717]">
                      Detalhes <ChevronRight size={18} aria-hidden="true" />
                    </span>
                  </div>

                  <div className="flex gap-4 p-5 sm:items-center sm:p-6">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[color:var(--color-surface)] text-[color:var(--color-icon)] sm:h-24 sm:w-24">
                      {order.previewImageUrl ? (
                        <img src={order.previewImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package size={34} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span
                          className={[
                            'w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset',
                            status.className,
                          ].join(' ')}
                        >
                          {status.label}
                        </span>
                        <p className="text-lg font-bold text-[#2a0f3d]">{format(order.total)}</p>
                      </div>
                      <p className="mt-3 truncate text-sm font-semibold text-[#2a0f3d]">
                        {order.previewName || 'Itens do pedido'}
                      </p>
                      <p className="mt-1 text-sm text-[#6b665f]">
                        {order.itemCount === 1 ? '1 item' : `${order.itemCount ?? 0} itens`} · Toque para ver
                        o acompanhamento
                      </p>
                    </div>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </section>
      )}

      <div className="flex items-center justify-center gap-2 pt-2 text-sm text-[#6b665f]">
        <ShoppingBag size={16} className="text-[#d89a28]" aria-hidden="true" />
        Seus pedidos ficam reunidos em um só lugar.
      </div>
    </div>
  )
}
