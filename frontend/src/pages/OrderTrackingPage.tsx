import { Check, Package, ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'

type OrderPublic = {
  id: string
  customerName: string
  total: number
  paymentStatus: string
  orderStatus: string
  origin: string
  createdAt: string
  shipping: number
  discount: number
  items: Array<{ name: string; price: number; quantity: number }>
  statuses: Array<{ label: string; done: boolean }>
}

export function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>()
  const format = useCurrency()
  const [order, setOrder] = useState<OrderPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api
      .get<OrderPublic>(`/order/${id}`)
      .then(setOrder)
      .catch(() => setError('Pedido nao encontrado'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <Skeleton className="h-12 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[28px]" />
        ))}
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <Package size={48} className="mx-auto text-stone-300" />
        <h1 className="mt-6 text-3xl font-semibold text-[#2a0f3d]">Pedido nao encontrado</h1>
        <p className="mt-3 text-sm text-[#6b665f]">
          {error || 'Verifique o numero do pedido e tente novamente.'}
        </p>
        <Link to="/" className="mt-8 inline-block">
          <Button>Voltar ao inicio</Button>
        </Link>
      </div>
    )
  }

  const steps = [
    { label: 'Confirmado', icon: ShoppingBag, done: true },
    { label: 'Pago', icon: Check, done: order.orderStatus !== 'aguardando_pagamento' },
    {
      label: 'Enviado',
      icon: Truck,
      done: order.orderStatus === 'enviado' || order.orderStatus === 'entregue',
    },
    { label: 'Entregue', icon: Package, done: order.orderStatus === 'entregue' },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:py-12">
      <Reveal>
        <div className="text-center">
          <p className="eyebrow">Acompanhe seu pedido</p>
          <h1 className="mt-2 text-4xl text-[#2a0f3d]">Pedido #{order.id.slice(0, 8)}</h1>
          <p className="mt-2 text-sm text-[#6b665f]">
            {new Date(order.createdAt).toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="surface-panel p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.label} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={[
                    'flex h-12 w-12 items-center justify-center rounded-full',
                    step.done ? 'bg-[#0f8a5f] text-white' : 'bg-stone-100 text-stone-400',
                  ].join(' ')}
                >
                  <step.icon size={20} />
                </div>
                <span className="text-center text-xs font-semibold text-[#6b665f]">{step.label}</span>
                {index < steps.length - 1 ? (
                  <div
                    className={[
                      'absolute left-[calc(50%+2rem)] hidden h-0.5 sm:block',
                      step.done ? 'bg-[#0f8a5f]' : 'bg-stone-200',
                    ].join(' ')}
                    style={{ width: 'calc(33% - 3rem)' }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="surface-panel p-6">
          <h2 className="text-2xl text-[#2a0f3d]">Resumo</h2>
          <div className="mt-4 space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <p className="font-semibold text-[#2a0f3d]">{item.name}</p>
                  <p className="text-sm text-[#6b665f]">Qtd: {item.quantity}</p>
                </div>
                <p className="font-semibold text-[#2a0f3d]">{format(item.price * item.quantity)}</p>
              </div>
            ))}
            {order.discount > 0 ? (
              <div className="flex justify-between text-sm text-[#0f8a5f]">
                <span>Desconto</span>
                <span>-{format(order.discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm text-[#6b665f]">
              <span>Frete</span>
              <span>{format(order.shipping)}</span>
            </div>
            <div className="flex justify-between pt-3 text-xl font-bold text-[#2a0f3d]">
              <span>Total</span>
              <span>{format(order.total)}</span>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="text-center">
          <Link to="/">
            <Button variant="secondary">Voltar ao início</Button>
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
