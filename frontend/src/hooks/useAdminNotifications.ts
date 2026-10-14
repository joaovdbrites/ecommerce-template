import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export type OrderNotification = {
  id: string
  customerName: string
  customerPhone: string
  total: number
  paymentStatus: string
  orderStatus: string
  deliveryMode: string
  createdAt: string
  read: boolean
}

export type OrderNotificationDetail = OrderNotification & {
  items: Array<{ name: string; price: number; quantity: number }>
  address: {
    street: string
    number: string
    neighborhood: string
    city: string
    state: string
    cep: string
  }
}

const POLL_INTERVAL_MS = 30000

/**
 * Contador de pedidos nao lidos (poll periodico, pro sino do admin) e lista
 * sob demanda (so busca quando a gaveta abre, pra nao pesar o header toda hora).
 */
export function useAdminNotifications(enabled: boolean, token: string | null) {
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<OrderNotification[]>([])
  const [loading, setLoading] = useState(false)

  const refreshUnreadCount = useCallback(() => {
    if (!enabled) return
    api
      .get<{ unread: number }>('/admin/notifications/unread-count', token ?? undefined)
      .then((data) => setUnread(data.unread))
      .catch(() => undefined)
  }, [enabled, token])

  useEffect(() => {
    if (!enabled) return
    refreshUnreadCount()
    const interval = window.setInterval(refreshUnreadCount, POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [enabled, refreshUnreadCount])

  const loadNotifications = useCallback(() => {
    if (!enabled) return
    setLoading(true)
    api
      .get<OrderNotification[]>('/admin/notifications', token ?? undefined)
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false))
  }, [enabled, token])

  const markRead = useCallback(
    (orderId: string) =>
      api
        .post<OrderNotificationDetail & { unread: number }>(
          `/admin/notifications/${orderId}/read`,
          {},
          token ?? undefined,
        )
        .then((detail) => {
          setUnread(detail.unread)
          setNotifications((current) =>
            current.map((item) => (item.id === orderId ? { ...item, read: true } : item)),
          )
          return detail
        }),
    [token],
  )

  return { unread, notifications, loading, loadNotifications, markRead }
}
