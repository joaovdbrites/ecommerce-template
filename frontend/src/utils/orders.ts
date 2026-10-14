import type { CustomerOrder, CustomerOrderDetail } from '../types'

type OrderStatusSource = Pick<CustomerOrder, 'orderStatus' | 'paymentStatus'>

type StatusPresentation = {
  label: string
  className: string
}

const cancelledPaymentStatuses = new Set(['cancelled', 'rejected'])

export function formatOrderDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function isOrderCancelled(order: OrderStatusSource) {
  return order.orderStatus === 'cancelado' || cancelledPaymentStatuses.has(order.paymentStatus)
}

export function getOrderStatusPresentation(order: OrderStatusSource): StatusPresentation {
  if (isOrderCancelled(order)) {
    return { label: 'Compra cancelada', className: 'bg-rose-50 text-rose-700 ring-rose-200' }
  }
  if (order.orderStatus === 'entregue') {
    return { label: 'Pedido entregue', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  }
  if (order.orderStatus === 'enviado') {
    return { label: 'Pedido enviado', className: 'bg-sky-50 text-sky-700 ring-sky-200' }
  }
  if (order.orderStatus === 'pago') {
    return { label: 'Pagamento aprovado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  }
  return { label: 'Aguardando pagamento', className: 'bg-amber-50 text-amber-700 ring-amber-200' }
}

export function getPaymentPresentation(order: CustomerOrderDetail): StatusPresentation {
  if (isOrderCancelled(order)) {
    return { label: 'Compra cancelada.', className: 'text-rose-700' }
  }
  if (order.orderStatus === 'aguardando_pagamento') {
    return { label: 'Aguardando confirmação do pagamento.', className: 'text-amber-700' }
  }
  return { label: 'Pagamento aprovado.', className: 'text-emerald-700' }
}
