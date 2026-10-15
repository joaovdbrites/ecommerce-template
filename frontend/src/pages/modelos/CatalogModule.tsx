import { ChevronLeft, ChevronRight, Package, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { OrganizerNode } from '../../types/organizer'
import { CategoryFilterDrawer, CategoryFilterPanel } from '../../components/category/CategoryFilterDrawer'
import {
  emptyCatalogFilters,
  formatCatalogVolume,
  type CatalogFilters,
} from '../../components/category/catalogFilters'
import { ItemCard, type ItemCardContent } from '../../components/item/ItemCard'

const ITEMS_PER_PAGE = 8

type CatalogModuleProps = {
  module: OrganizerNode
  items: ItemCardContent[]
}

// Aplica os filtros de preco/marca/volume e a ordenacao escolhida sobre a
// lista de itens do catalogo. Chamada antes de paginar o resultado.
function filterItems(items: ItemCardContent[], filters: CatalogFilters) {
  const filtered = items.filter((item) => {
    const price = item.price ?? 0
    return (
      (filters.minPrice === null || price >= filters.minPrice) &&
      (filters.maxPrice === null || price <= filters.maxPrice) &&
      (filters.brands.length === 0 || Boolean(item.brand && filters.brands.includes(item.brand))) &&
      (filters.volumes.length === 0 ||
        Boolean(item.volumeMl && filters.volumes.includes(formatCatalogVolume(item.volumeMl))))
    )
  })

  if (filters.sort === 'price-asc') {
    return filtered.sort((left, right) => (left.price ?? 0) - (right.price ?? 0))
  }
  if (filters.sort === 'price-desc') {
    return filtered.sort((left, right) => (right.price ?? 0) - (left.price ?? 0))
  }
  if (filters.sort === 'date-desc') {
    return filtered.sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  }
  if (filters.sort === 'brand') {
    return filtered.sort((left, right) => (left.brand ?? '').localeCompare(right.brand ?? '', 'pt-BR'))
  }
  // "Mais avaliados", "Mais procurado" e "Promocao" ainda nao tem dado de origem
  // (avaliacoes, popularidade e sinalizador de promocao) - mantidos na lista sem reordenar.
  return filtered
}

// Renderiza um modulo de catalogo no site publico: grade paginada de
// produtos com filtro lateral (desktop) ou em gaveta (mobile), no modelo
// usado pelas paginas de categoria.
export function CatalogModule({ module, items }: CatalogModuleProps) {
  const [page, setPage] = useState(0)
  // Controla a gaveta de filtros no mobile (no desktop o painel fica sempre visivel).
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters)
  // Lista filtrada/ordenada, recalculada so quando os filtros ou os itens mudam.
  const filteredItems = useMemo(() => filterItems(items, filters), [filters, items])
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))
  // Garante que a pagina atual nunca fique fora do intervalo valido (ex.:
  // apos um filtro reduzir a quantidade de paginas disponiveis).
  const safePage = Math.min(page, pageCount - 1)
  const visibleItems = filteredItems.slice(
    safePage * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE + ITEMS_PER_PAGE,
  )
  // Quantidade de filtros ativos no momento, exibida como contador no botao
  // de filtro mobile.
  const activeFilterCount =
    Number(filters.pickupOnly) +
    Number(filters.minPrice !== null) +
    Number(filters.maxPrice !== null) +
    filters.brands.length +
    filters.volumes.length +
    Number(filters.sort !== 'default')

  // Ao mudar os filtros, sempre volta para a primeira pagina - senao o
  // usuario poderia ficar numa pagina que nao existe mais apos filtrar.
  const handleFiltersChange = (next: CatalogFilters) => {
    setFilters(next)
    setPage(0)
  }

  // Sem nenhum item vinculado ao catalogo, nao ha o que mostrar.
  if (items.length === 0) return null

  return (
    <section aria-label={module.name} className="lg:grid lg:grid-cols-[280px_1fr] lg:items-start lg:gap-6">
      {/* Painel de filtro fixo na lateral, visivel so a partir do breakpoint lg. */}
      <div className="hidden lg:block">
        <CategoryFilterPanel items={items} value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="space-y-4">
        {/* Abaixo do lg, o filtro vira um botao que abre a gaveta (CategoryFilterDrawer). */}
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-2 rounded-[14px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-[#2a0f3d] hover:border-[#b77717] hover:bg-[#fff8ea] lg:hidden"
        >
          <SlidersHorizontal size={16} className="text-[#b77717]" />
          Filtro
          {activeFilterCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#5b247f] px-1.5 text-[10px] text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        <CategoryFilterDrawer
          open={filterOpen}
          items={items}
          value={filters}
          onChange={handleFiltersChange}
          onClose={() => setFilterOpen(false)}
        />

        <div className="space-y-[10px]">
          <div className="field-base flex items-center border-none bg-transparent">
            {filteredItems.length} {filteredItems.length === 1 ? 'item encontrado' : 'itens encontrados'}
          </div>
          <div className="field-base flex items-center gap-2 border-none bg-transparent">
            <Package size={18} className="shrink-0 text-[color:var(--color-icon)]" />
            <span className="font-semibold">{module.name}</span>
          </div>
          {module.description ? (
            <p className="px-3 text-xs leading-5 text-[#6b665f] sm:text-sm">{module.description}</p>
          ) : null}
        </div>

        {/* Grade da pagina atual, ou um aviso quando os filtros zeram o resultado. */}
        {visibleItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
            {visibleItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-[#ddc7ea] bg-white/60 px-5 py-10 text-center text-sm text-[#6b665f]">
            Nenhum item corresponde aos filtros selecionados.
          </div>
        )}

        {/* Paginacao so aparece quando ha mais de uma pagina de resultado. */}
        {pageCount > 1 ? (
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={safePage === 0}
              aria-label="Página anterior"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-[#2a0f3d] disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-[#6b665f]">
              Página {safePage + 1} de {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={safePage === pageCount - 1}
              aria-label="Próxima página"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-[#2a0f3d] disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
