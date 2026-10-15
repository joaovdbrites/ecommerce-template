import type { CustomerOrder, CustomerOrderDetail } from '../types'

// Subconjunto minimo de campos de um pedido necessario para decidir sua
// apresentacao de status - permite reusar a logica tanto com CustomerOrder
// (lista) quanto com CustomerOrderDetail (detalhe), sem exigir o objeto inteiro.
type OrderStatusSource = Pick<CustomerOrder, 'orderStatus' | 'paymentStatus'>

// Rotulo e classe Tailwind prontos para exibir o status de um pedido/pagamento.
type StatusPresentation = {
  label: string
  className: string
}

// Status de pagamento que, quando presentes, indicam que o pedido foi
// efetivamente cancelado (mesmo que orderStatus nao diga "cancelado" explicitamente).
const cancelledPaymentStatuses = new Set(['cancelled', 'rejected'])

// Formata uma data ISO no padrao brasileiro (dd/mm/aaaa).
export function formatOrderDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Um pedido e considerado cancelado se o status do pedido em si diz isso ou
// se o pagamento foi cancelado/recusado (cobre o caso de o pedido nunca ter
// avancado de status porque o pagamento nem chegou a ser aprovado).
export function isOrderCancelled(order: OrderStatusSource) {
  return order.orderStatus === 'cancelado' || cancelledPaymentStatuses.has(order.paymentStatus)
}

// Decide o rotulo/cor do badge de status exibido na lista de pedidos do
// cliente, checando cancelamento primeiro e depois cada etapa do fluxo normal
// (entregue > enviado > pago > aguardando pagamento, do mais avancado ao menos).
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

// Mensagem de status especifica para a secao de pagamento no detalhe do
// pedido - mais simples que getOrderStatusPresentation pois so distingue
// cancelado / aguardando pagamento / aprovado.
export function getPaymentPresentation(order: CustomerOrderDetail): StatusPresentation {
  if (isOrderCancelled(order)) {
    return { label: 'Compra cancelada.', className: 'text-rose-700' }
  }
  if (order.orderStatus === 'aguardando_pagamento') {
    return { label: 'Aguardando confirmação do pagamento.', className: 'text-amber-700' }
  }
  return { label: 'Pagamento aprovado.', className: 'text-emerald-700' }
}
