import { ArrowLeft, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ItemCardContent } from '../item/ItemCard'
import {
  catalogSortLabels,
  emptyCatalogFilters,
  formatCatalogVolume,
  type CatalogFilters,
  type CatalogSort,
} from './catalogFilters'

const sliderThumbClass =
  'pointer-events-none absolute top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 ' +
  '[&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#d89a28] [&::-webkit-slider-thumb]:shadow ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white ' +
  '[&::-moz-range-thumb]:bg-[#d89a28]'

// Titulo de uma secao de filtro (ex: "Preço", "Marcas").
function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#d89a28]">{children}</h3>
}

// Linha de filtro com label e checkbox, reaproveitada por entrega, marcas, volume e ordenacao.
function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 text-sm text-[#2a0f3d]">
      <span>{label}</span>
      <input
        className="h-4 w-4 shrink-0 accent-[#d89a28]"
        type="checkbox"
        checked={checked}
        onChange={onToggle}
      />
    </label>
  )
}

// Slider de faixa de preco com dois cabos (minimo e maximo), desenhado com dois
// <input type="range"> sobrepostos e uma barra colorida entre eles.
function PriceRangeSlider({
  bounds,
  value,
  onChange,
}: {
  bounds: [number, number]
  value: [number, number]
  onChange: (next: [number, number]) => void
}) {
  const [boundMin, boundMax] = bounds
  const [lo, hi] = value
  const span = boundMax - boundMin || 1
  // Posicao em % de cada cabo, para desenhar a barra preenchida entre eles.
  const pctLo = ((lo - boundMin) / span) * 100
  const pctHi = ((hi - boundMin) / span) * 100

  return (
    <div className="relative h-8">
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-stone-300" />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#d89a28]"
        style={{ left: `${pctLo}%`, right: `${100 - pctHi}%` }}
      />
      <input
        aria-label="Preço mínimo"
        type="range"
        min={boundMin}
        max={boundMax}
        value={lo}
        onChange={(event) => onChange([Math.min(Number(event.target.value), hi), hi])}
        className={sliderThumbClass}
      />
      <input
        aria-label="Preço máximo"
        type="range"
        min={boundMin}
        max={boundMax}
        value={hi}
        onChange={(event) => onChange([lo, Math.max(Number(event.target.value), lo)])}
        className={sliderThumbClass}
      />
    </div>
  )
}

// Conteudo compartilhado dos filtros (entrega, preco, marca, volume, ordenar),
// usado tanto pelo drawer mobile quanto pelo painel lateral de desktop.
function FilterSections({
  filters,
  items,
  onChange,
}: {
  filters: CatalogFilters
  items: ItemCardContent[]
  onChange: (next: CatalogFilters) => void
}) {
  const [brandSearch, setBrandSearch] = useState('')

  // Marcas distintas presentes nos itens da categoria, em ordem alfabetica pt-BR.
  const brands = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.brand?.trim()).filter((brand): brand is string => Boolean(brand))),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [items],
  )
  // Marcas filtradas pelo texto digitado no campo de busca de marca.
  const visibleBrands = brands.filter((brand) =>
    brand.toLocaleLowerCase('pt-BR').includes(brandSearch.trim().toLocaleLowerCase('pt-BR')),
  )
  // Volumes (ml) distintos presentes nos itens, ordenados do menor para o maior.
  const volumes = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.volumeMl).filter((volume): volume is number => Boolean(volume))),
      )
        .sort((left, right) => left - right)
        .map(formatCatalogVolume),
    [items],
  )

  // Faixa de preco possivel (min/max reais dos itens), usada como limite do slider.
  const prices = items.map((item) => item.price ?? 0).filter((price) => price > 0)
  const lowestPrice = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0
  const highestPrice = prices.length > 0 ? Math.ceil(Math.max(...prices)) : 0
  const priceValue: [number, number] = [filters.minPrice ?? lowestPrice, filters.maxPrice ?? highestPrice]

  // Adiciona ou remove um valor de uma lista de filtro (marcas/volumes selecionados).
  const toggleInList = (list: string[], value: string) =>
    list.includes(value) ? list.filter((current) => current !== value) : [...list, value]

  return (
    <>
      <section className="space-y-3">
        <SectionTitle>Opções de entrega</SectionTitle>
        <CheckRow
          label="Retirada na loja"
          checked={filters.pickupOnly}
          onToggle={() => onChange({ ...filters, pickupOnly: !filters.pickupOnly })}
        />
      </section>

      <div className="h-px bg-stone-300" />

      <section className="space-y-4">
        <SectionTitle>Preço</SectionTitle>
        <PriceRangeSlider
          bounds={[lowestPrice, highestPrice]}
          value={priceValue}
          onChange={([minPrice, maxPrice]) => onChange({ ...filters, minPrice, maxPrice })}
        />
        <div className="flex items-center gap-3">
          <label className="flex-1 text-xs font-medium text-[#2a0f3d]">
            Preço mín.
            <input
              type="number"
              min={0}
              value={filters.minPrice ?? ''}
              placeholder={String(lowestPrice)}
              onChange={(event) =>
                onChange({
                  ...filters,
                  minPrice: event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
                })
              }
              className="mt-1 w-full rounded-[14px] border border-stone-300 bg-white px-3 py-2 text-sm text-[#2a0f3d] focus:border-[#d89a28] focus:outline-none"
            />
          </label>
          <label className="flex-1 text-xs font-medium text-[#2a0f3d]">
            Preço máx.
            <input
              type="number"
              min={0}
              value={filters.maxPrice ?? ''}
              placeholder={String(highestPrice)}
              onChange={(event) =>
                onChange({
                  ...filters,
                  maxPrice: event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
                })
              }
              className="mt-1 w-full rounded-[14px] border border-stone-300 bg-white px-3 py-2 text-sm text-[#2a0f3d] focus:border-[#d89a28] focus:outline-none"
            />
          </label>
        </div>
      </section>

      <div className="h-px bg-stone-300" />

      <section className="space-y-3">
        <SectionTitle>Marcas</SectionTitle>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b665f]"
          />
          <input
            placeholder="Buscar marca"
            value={brandSearch}
            onChange={(event) => setBrandSearch(event.target.value)}
            className="w-full rounded-[16px] border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-[#2a0f3d] placeholder:text-stone-400 focus:border-[#d89a28] focus:outline-none"
          />
        </div>
        <div>
          {visibleBrands.length > 0 ? (
            visibleBrands.map((brand) => (
              <CheckRow
                key={brand}
                label={brand}
                checked={filters.brands.includes(brand)}
                onToggle={() => onChange({ ...filters, brands: toggleInList(filters.brands, brand) })}
              />
            ))
          ) : (
            <p className="py-2 text-xs text-[#6b665f]">Nenhuma marca encontrada.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Volume</SectionTitle>
        <div>
          {volumes.length > 0 ? (
            volumes.map((volume) => (
              <CheckRow
                key={volume}
                label={volume}
                checked={filters.volumes.includes(volume)}
                onToggle={() => onChange({ ...filters, volumes: toggleInList(filters.volumes, volume) })}
              />
            ))
          ) : (
            <p className="py-2 text-xs text-[#6b665f]">Nenhum volume cadastrado.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Ordenar</SectionTitle>
        <div>
          {(Object.keys(catalogSortLabels) as CatalogSort[])
            .filter((sort) => sort !== 'default')
            .map((sort) => (
              <CheckRow
                key={sort}
                label={catalogSortLabels[sort]}
                checked={filters.sort === sort}
                onToggle={() => onChange({ ...filters, sort: filters.sort === sort ? 'default' : sort })}
              />
            ))}
        </div>
      </section>
    </>
  )
}

type CategoryFilterDrawerProps = {
  open: boolean
  items: ItemCardContent[]
  value: CatalogFilters
  onChange: (filters: CatalogFilters) => void
  onClose: () => void
}

// Drawer de filtros em tela cheia para mobile: abre por cima de tudo (via
// portal) e bloqueia o scroll do fundo enquanto estiver aberto.
export function CategoryFilterDrawer({ open, items, value, onChange, onClose }: CategoryFilterDrawerProps) {
  // Enquanto aberto: trava o scroll da pagina e fecha com a tecla Esc.
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  // Nao renderiza nada (nem o portal) quando o drawer esta fechado.
  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filtros de produtos"
      className="fixed inset-0 z-50 flex flex-col bg-[#FAF6EF]"
    >
      <div className="flex items-center gap-3 bg-[color:var(--color-primary)] px-4 py-4 shadow-[0_8px_14px_-6px_color-mix(in_srgb,var(--color-primary)_70%,black)]">
        <button type="button" aria-label="Fechar filtro" onClick={onClose} className="text-[#fafaf8]">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-lg font-semibold text-[#fafaf8]">Filtro</h2>
      </div>
      <div className="flex items-center justify-between bg-[color:var(--color-primary)] px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm font-semibold text-[#fafaf8]">
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => onChange(emptyCatalogFilters)}
          className="flex items-center gap-1 text-sm font-semibold text-[#fafaf8]"
        >
          <X size={14} />
          Limpar filtro
        </button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 text-[#2a0f3d]">
        <FilterSections filters={value} items={items} onChange={onChange} />
      </div>
    </div>,
    document.body,
  )
}

// Versao em painel lateral fixo dos mesmos filtros, usada no layout de desktop
// (ao lado da grade de produtos, em vez de um drawer que cobre a tela).
export function CategoryFilterPanel({
  items,
  value,
  onChange,
}: {
  items: ItemCardContent[]
  value: CatalogFilters
  onChange: (filters: CatalogFilters) => void
}) {
  return (
    <aside
      className="h-fit space-y-6 border border-stone-200 bg-[#FAF6EF] p-5 text-[#2a0f3d]"
      style={{ borderRadius: 'var(--radius-window)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#3a164f]">Filtro</h2>
        <button
          type="button"
          onClick={() => onChange(emptyCatalogFilters)}
          className="flex items-center gap-1 text-xs font-semibold text-[#b77717] hover:text-[#b77717]"
        >
          <X size={13} />
          Limpar filtro
        </button>
      </div>
      <FilterSections filters={value} items={items} onChange={onChange} />
    </aside>
  )
}
