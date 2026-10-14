import { Tag } from 'lucide-react'
import { useDragScroll } from '../hooks/useDragScroll'

const MAX_VISIBLE_BRANDS = 6

export function BrandMarquee({ brands }: { brands: string[] }) {
  const visible = brands.slice(0, MAX_VISIBLE_BRANDS)
  const items = [...visible, ...visible]
  const { ref, dragging, handlers } = useDragScroll<HTMLDivElement>({ loopItemCount: visible.length })

  if (visible.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag size={24} className="shrink-0 text-[color:var(--color-icon)]" aria-hidden="true" />
        <h2 className="text-base font-bold uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
          Marcas trabalhadas
        </h2>
      </div>
      <div
        ref={ref}
        {...handlers}
        className={[
          'no-scrollbar flex items-center gap-3 overflow-x-auto',
          dragging ? 'cursor-grabbing select-none' : 'cursor-grab',
        ].join(' ')}
      >
        {items.map((brand, index) => (
          <div
            key={`${brand}-${index}`}
            className="shrink-0 rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b665f] transition duration-300 hover:-translate-y-0.5 hover:border-[color:var(--color-accent)] hover:text-[#2a0f3d] hover:shadow-[0_16px_30px_-20px_color-mix(in_srgb,var(--color-accent)_50%,transparent)]"
          >
            {brand}
          </div>
        ))}
      </div>
    </section>
  )
}
