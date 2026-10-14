import { ChevronDown, MapPin, MessageCircle, Package, Phone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import type { OrderNotification, OrderNotificationDetail } from '../../hooks/useAdminNotifications'
import { toWhatsappDigits } from '../../utils/checkout'
import { useStoreTheme } from '../../hooks/useStoreTheme'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function customerGreeting(detail: OrderNotificationDetail, storeName: string) {
  const firstName = detail.customerName.split(' ')[0]
  const modeLabel = detail.deliveryMode === 'pickup' ? 'para retirada na loja' : 'para entrega'
  return `Oi ${firstName}! Aqui é da ${storeName}. Recebemos seu pedido de ${formatCurrency(detail.total)} ${modeLabel}. Vamos confirmar os detalhes?`
}

export function NotificationsDrawer({
  open,
  onClose,
  notifications,
  loading,
  loadNotifications,
  markRead,
}: {
  open: boolean
  onClose: () => void
  notifications: OrderNotification[]
  loading: boolean
  loadNotifications: () => void
  markRead: (orderId: string) => Promise<OrderNotificationDetail & { unread: number }>
}) {
  const { storeName } = useStoreTheme()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, OrderNotificationDetail>>({})

  useEffect(() => {
    if (open) loadNotifications()
  }, [open, loadNotifications])

  function handleClose() {
    setExpandedId(null)
    onClose()
  }

  function toggleOrder(order: OrderNotification) {
    if (expandedId === order.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(order.id)
    if (!details[order.id]) {
      markRead(order.id).then((detail) => setDetails((current) => ({ ...current, [order.id]: detail })))
    }
  }

  return (
    <>
      {open ? (
        <div
          aria-hidden="true"
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-[#081b32]/40 backdrop-blur-[1px]"
        />
      ) : null}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Notificações"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col overflow-hidden bg-[#fdfbf7] shadow-[var(--shadow-window)] transition-transform duration-300 ${
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-dark)_100%)] px-4 py-3 text-white">
          <h2 className="text-sm font-semibold">Notificações</h2>
          <button
            type="button"
            aria-label="Fechar notificações"
            onClick={handleClose}
            className="rounded-full p-1.5 hover:bg-white/15"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-xs text-[#6b665f]">Carregando...</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[#6b665f]">Nenhum pedido ainda.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {notifications.map((order) => {
                const detail = details[order.id]
                const isExpanded = expandedId === order.id
                const whatsappPhone = detail ? toWhatsappDigits(detail.customerPhone) : ''
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => toggleOrder(order)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fff8ea] ${
                        !order.read ? 'bg-[#fff1d6]/60' : ''
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff1d6] text-[#b77717]">
                        <Package size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-[#2a0f3d]">
                            {order.customerName}
                          </span>
                          {!order.read ? (
                            <span
                              aria-label="Não lido"
                              className="h-2 w-2 shrink-0 rounded-full bg-[#d89a28]"
                            />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-[#6b665f]">
                          {formatCurrency(order.total)} ·{' '}
                          {order.deliveryMode === 'pickup' ? 'Retirada na loja' : 'Entrega'}
                        </span>
                      </span>
                      <ChevronDown
                        size={14}
                        className={`shrink-0 text-[#6b665f] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-stone-100 bg-[#fffaf0] px-4 py-3">
                        {!detail ? (
                          <p className="text-xs text-[#6b665f]">Carregando detalhes...</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-xs text-[#2a0f3d]">
                              <Phone size={13} className="shrink-0 text-[#b77717]" />
                              {detail.customerPhone || 'Telefone não informado'}
                            </div>
                            <div className="flex items-start gap-2 text-xs text-[#2a0f3d]">
                              <MapPin size={13} className="mt-0.5 shrink-0 text-[#b77717]" />
                              <span>
                                {detail.deliveryMode === 'pickup'
                                  ? 'Retirada na loja'
                                  : detail.address.street
                                    ? `${detail.address.street}${detail.address.number ? `, ${detail.address.number}` : ''} - ${detail.address.city}/${detail.address.state}`
                                    : 'Endereço não informado'}
                              </span>
                            </div>
                            <ul className="space-y-1">
                              {detail.items.map((item, index) => (
                                <li
                                  key={index}
                                  className="flex items-center justify-between text-[11px] text-[#2a0f3d]"
                                >
                                  <span className="min-w-0 truncate">
                                    {item.quantity}x {item.name}
                                  </span>
                                  <span className="shrink-0 font-semibold">
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {whatsappPhone ? (
                              <a
                                href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(customerGreeting(detail, storeName))}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Button type="button" fullWidth size="sm">
                                  <MessageCircle size={15} /> Confirmar no WhatsApp
                                </Button>
                              </a>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
