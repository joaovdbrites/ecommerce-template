import {
  AlertCircle,
  Check,
  ChevronLeft,
  CircleDollarSign,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { CustomerOrderDetail } from '../types'
import { formatOrderDate, getPaymentPresentation, isOrderCancelled } from '../utils/orders'

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, scope } = useAuth()
  const format = useCurrency()
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null)
  const [error, setError] = useState('')
  const canLoadOrder = Boolean(token && scope === 'customer' && id)

  useEffect(() => {
    if (!token || scope !== 'customer' || !id) return

    let ignoreResult = false
    api
      .get<CustomerOrderDetail>(`/customer/orders/${id}`, token)
      .then((response) => {
        if (!ignoreResult) setOrder(response)
      })
      .catch(() => {
        if (!ignoreResult) setError('Não foi possível encontrar este pedido.')
      })

    return () => {
      ignoreResult = true
    }
  }, [id, scope, token])

  if (canLoadOrder && !order && !error) {
    return <Skeleton className="h-[620px] w-full rounded-[36px]" />
  }

  if (!canLoadOrder || !order || error) {
    const message = error || 'Os detalhes deste pedido serão habilitados na próxima implementação.'
    return (
      <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <Package size={44} className="mx-auto text-stone-300" />
        <h1 className="mt-5 text-4xl text-[#2a0f3d]">Pedido não encontrado</h1>
        <p className="mt-3 text-sm text-[#6b665f]">{message}</p>
        <Link to="/pedidos" className="mt-6 inline-block">
          <Button variant="secondary">Voltar aos pedidos</Button>
        </Link>
      </section>
    )
  }

  const cancelled = isOrderCancelled(order)
  const message = getPaymentPresentation(order)
  const paid = order.orderStatus !== 'aguardando_pagamento' && !cancelled
  const sent = order.orderStatus === 'enviado' || order.orderStatus === 'entregue'
  const delivered = order.orderStatus === 'entregue'
  const steps = [
    { label: 'Pedido recebido', icon: ShoppingBag, done: true, danger: false },
    { label: 'Pagamento aprovado', icon: Check, done: paid, danger: false },
    { label: 'Enviado', icon: Truck, done: sent, danger: false },
    {
      label: cancelled ? 'Pedido cancelado' : 'Entregue',
      icon: cancelled ? AlertCircle : Package,
      done: delivered || cancelled,
      danger: cancelled,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Reveal>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-[#6b665f]">
              Minha conta / Pedidos /{' '}
              <span className="font-semibold text-[#2a0f3d]">#{order.id.slice(0, 8)}</span>
            </p>
            <h1 className="mt-2 text-4xl leading-none text-[#2a0f3d] sm:text-5xl">Detalhes do pedido</h1>
          </div>
          <Link to="/pedidos" className="text-sm font-semibold text-[#b77717] hover:text-[#b77717]">
            Voltar aos pedidos
          </Link>
        </div>
      </Reveal>

      <p className={['px-1 text-sm font-bold', message.className].join(' ')}>{message.label}</p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Reveal delay={40}>
            <section className="surface-panel overflow-hidden p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <p className="eyebrow">Pedido #{order.id.slice(0, 8)}</p>
                  <p className="mt-2 text-sm text-[#6b665f]">
                    Realizado em {formatOrderDate(order.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-[#fff1d6] px-3 py-1 text-xs font-bold text-[#b77717]">
                  {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              <div className="divide-y divide-stone-100">
                {order.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex gap-4 py-5">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[color:var(--color-surface)] text-[color:var(--color-icon)]">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package size={32} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#2a0f3d]">{item.name}</p>
                      <p className="mt-2 text-sm text-[#6b665f]">Quantidade: {item.quantity}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-[#2a0f3d]">
                      {format(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-stone-100 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b665f]">Acompanhamento</p>
                <div className="mt-5 grid grid-cols-4 gap-1">
                  {steps.map((step, index) => (
                    <div key={step.label} className="relative flex min-w-0 flex-col items-center text-center">
                      {index > 0 ? (
                        <span
                          className={[
                            'absolute right-1/2 top-4 h-0.5 w-full',
                            step.done ? 'bg-[#d89a28]' : 'bg-stone-200',
                          ].join(' ')}
                        />
                      ) : null}
                      <span
                        className={[
                          'relative z-10 flex h-8 w-8 items-center justify-center rounded-full',
                          step.danger
                            ? 'bg-rose-100 text-rose-700'
                            : step.done
                              ? 'bg-[#fff1d6] text-[#b77717]'
                              : 'bg-stone-100 text-stone-400',
                        ].join(' ')}
                      >
                        <step.icon size={15} />
                      </span>
                      <span className="mt-2 text-[10px] font-semibold leading-4 text-[#6b665f] sm:text-xs">
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </Reveal>
        </div>

        <div className="space-y-5">
          <Reveal delay={80}>
            <aside className="surface-panel p-5 sm:p-6">
              <p className="eyebrow">Resumo</p>
              <div className="mt-5 space-y-3 text-sm text-[#6b665f]">
                <div className="flex justify-between gap-4">
                  <span>Produtos</span>
                  <span>{format(order.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Frete</span>
                  <span>{format(order.shipping)}</span>
                </div>
                {order.discount > 0 ? (
                  <div className="flex justify-between gap-4 text-emerald-700">
                    <span>Desconto</span>
                    <span>-{format(order.discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-stone-200 pt-4 text-base font-bold text-[#2a0f3d]">
                  <span>Total do pedido</span>
                  <span>{format(order.total)}</span>
                </div>
              </div>
              <div className="mt-5 rounded-[18px] bg-[#eadcf0] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#2a0f3d]">
                  <CircleDollarSign size={17} className="text-[#d89a28]" /> Pagamento
                </p>
                <p className="mt-2 text-sm text-[#6b665f]">
                  {order.paymentMethod || 'Pagamento online'} · {order.paymentStatus}
                </p>
              </div>
            </aside>
          </Reveal>

          <Reveal delay={120}>
            <aside className="surface-panel p-5 sm:p-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#2a0f3d]">
                <MapPin size={17} className="text-[#d89a28]" /> Entrega
              </p>
              <p className="mt-3 text-sm font-semibold text-[#2a0f3d]">
                {order.address.label || 'Endereço de entrega'}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#6b665f]">
                {order.address.street}, {order.address.number}
                <br />
                {order.address.neighborhood}
                <br />
                {order.address.city} - {order.address.state}
                <br />
                CEP {order.address.cep}
              </p>
            </aside>
          </Reveal>
        </div>
      </div>

      <div className="pb-3 text-center">
        <Link to="/pedidos">
          <Button variant="secondary">
            <ChevronLeft size={16} /> Voltar aos pedidos
          </Button>
        </Link>
      </div>
    </div>
  )
}
