import type { OrganizerNode } from '../../types/organizer'

type HighlightModuleProps = {
  module: OrganizerNode
}

export function HighlightModule({ module }: HighlightModuleProps) {
  if (!module.imageUrl) return null

  const sizeClassName = {
    small: 'aspect-[16/7] sm:aspect-[16/5] lg:aspect-[16/4]',
    medium: 'aspect-[4/3] sm:aspect-[16/7] lg:aspect-[16/5]',
    large: 'aspect-square sm:aspect-[16/8] lg:aspect-[16/6]',
  }[module.size]

  return (
    <section
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-[24px] border border-stone-200 bg-[color:var(--color-surface)] text-[color:var(--color-icon)] sm:rounded-[28px] ${sizeClassName}`}
      aria-label={module.name}
    >
      <img src={module.imageUrl} alt={module.name} className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[color:var(--color-primary-dark)]/80 to-transparent px-5 pb-5 pt-16 text-white sm:px-7 sm:pb-7 lg:px-9 lg:pb-8">
        <h2 className="text-xl font-semibold sm:text-2xl lg:text-3xl">{module.name}</h2>
        {module.description ? (
          <p className="mt-1 max-w-3xl text-xs text-white/80 sm:text-sm">{module.description}</p>
        ) : null}
      </div>
    </section>
  )
}
