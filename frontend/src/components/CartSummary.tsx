import { useCurrency } from '../hooks/useCurrency'

const INSTALLMENTS = 12

export function CartSummary({
  subtotal,
  discount = 0,
  shipping = 0,
  total,
  couponCode,
  shippingLabel,
  compact = false,
}: {
  subtotal: number
  discount?: number
  shipping?: number
  total: number
  couponCode?: string
  shippingLabel?: string
  compact?: boolean
}) {
  const format = useCurrency()

  return (
    <section className={compact ? 'surface-soft p-5' : 'surface-panel p-6 sm:p-7'}>
      <div className="space-y-1">
        <p className="eyebrow">Resumo</p>
        <h2 className="text-3xl text-[#2a0f3d]">Pedido premium</h2>
      </div>

      <div className="mt-6 space-y-4 text-sm">
        <SummaryRow label="Subtotal" value={format(subtotal)} />
        {/* Oculto ate o desconto vir de fato da api (cupom aplicado); sem isso nao aparece. */}
        {discount > 0 ? <SummaryRow label="Desconto" value={`- ${format(discount)}`} highlight /> : null}
        <SummaryRow label={shippingLabel || 'Frete'} value={shipping > 0 ? format(shipping) : 'A calcular'} />
        {couponCode ? <SummaryRow label="Cupom informado" value={couponCode.toUpperCase()} /> : null}
      </div>

      <div className="mt-5 border-t border-[#e3cfee] pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-[#2a0f3d]">Total</span>
          <span className="text-2xl font-semibold text-[#2a0f3d]">{format(total)}</span>
        </div>
        <p className="mt-1 text-right text-xs text-[#6b665f]">
          ou {INSTALLMENTS}x de {format(total / INSTALLMENTS)} sem juros
        </p>
      </div>
    </section>
  )
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#6b665f]">{label}</span>
      <span className={highlight ? 'font-semibold text-[#0f8a5f]' : 'font-semibold text-[#2a0f3d]'}>
        {value}
      </span>
    </div>
  )
}
