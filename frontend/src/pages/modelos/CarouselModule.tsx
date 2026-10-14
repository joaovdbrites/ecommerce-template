import { Package } from 'lucide-react'
import type { OrganizerNode } from '../../types/organizer'
import { Carousel } from '../../components/Carousel'
import { ItemCard, type ItemCardContent } from '../../components/item/ItemCard'

type CarouselModuleProps = {
  module: OrganizerNode
  items: ItemCardContent[]
}

export function CarouselModule({ module, items }: CarouselModuleProps) {
  if (module.variant === 'banner-carousel') {
    const banners: Array<ItemCardContent | null> = items.length > 0 ? items : module.imageUrl ? [null] : []

    if (banners.length === 0) return null

    return (
      <section className="space-y-4" aria-label={module.name}>
        <Carousel
          ariaLabel={module.name}
          items={banners}
          getItemKey={(banner, index) => banner?.id ?? index}
          fullBleed
          itemClassName="shrink-0"
          className="gap-4 px-4 pb-2 sm:px-0 lg:gap-6"
          renderItem={(banner) => (
            <div className="relative flex aspect-[2/1] w-[calc(100dvw-2rem)] items-center justify-center overflow-hidden rounded-[24px] border border-stone-200 bg-[color:var(--color-surface)] text-[color:var(--color-icon)] sm:w-[520px] lg:w-[680px] xl:w-[800px]">
              <img
                src={banner?.imageUrl || module.imageUrl}
                alt={banner?.name || module.name}
                className="h-full w-full object-cover"
              />
              {banner?.name || module.name || banner?.description || module.description ? (
                <div className="absolute inset-x-0 bottom-0 bg-[color:var(--color-primary-dark)]/75 px-4 py-3 text-white">
                  <p className="text-sm font-semibold">{banner?.name || module.name}</p>
                  {banner?.description || module.description ? (
                    <p className="mt-1 text-xs text-white/75">{banner?.description || module.description}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        />
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section className="space-y-4" aria-label={module.name}>
      <div className="flex items-center gap-2">
        <Package size={28} className="shrink-0 text-[color:var(--color-icon)]" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--color-accent)] sm:text-base sm:tracking-[0.22em] lg:text-lg">
            {module.name}
          </h2>
          {module.description ? (
            <p className="mt-1 text-xs text-[#6b665f] sm:text-sm">{module.description}</p>
          ) : null}
        </div>
      </div>
      <Carousel
        ariaLabel={module.name}
        items={items}
        getItemKey={(item) => item.id}
        fullBleed
        itemClassName="shrink-0"
        className="gap-4 px-4 pb-2 sm:px-0 lg:gap-5"
        renderItem={(item) => <ItemCard className="w-[200px] sm:w-[220px] lg:w-[240px]" item={item} />}
      />
    </section>
  )
}
