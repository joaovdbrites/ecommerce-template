import type { ReactNode } from 'react'

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
  /** Ocupa a tela toda e centraliza na vertical. Para paginas que so tem essa
   *  mensagem, como o carrinho vazio. */
  fullPage = false,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
  fullPage?: boolean
}) {
  const card = (
    <div className="surface-soft mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-6 py-10 text-center">
      <p className="eyebrow">{eyebrow}</p>
      <div className="space-y-2">
        <h3 className="text-3xl text-[#2a0f3d]">{title}</h3>
        <p className="mx-auto max-w-md text-sm leading-6 text-[#6b665f]">{description}</p>
      </div>
      {action}
    </div>
  )

  if (!fullPage) return card

  return <div className="flex min-h-[60vh] items-center justify-center py-6">{card}</div>
}
