import type { ReactNode } from 'react'

type BadgeTone = 'amber' | 'success' | 'neutral' | 'danger' | 'trust'

const toneClasses: Record<BadgeTone, string> = {
  amber: 'bg-[#fff1d6] text-[#9b6110] border-[#f4d08a]',
  success: 'bg-[#eefaf5] text-[#0f8a5f] border-[#bde4d4]',
  neutral: 'bg-[#f6f1ea] text-[#6b665f] border-[#e3dbd0]',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  trust: 'bg-[#eadcf0] text-[#3a164f] border-[#ddc7ea]',
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
