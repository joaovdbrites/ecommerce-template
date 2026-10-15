// Opcoes de ordenacao disponiveis para listas de produtos (catalogo/categoria).
export type CatalogSort =
  | 'default'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'date-desc'
  | 'popularity-desc'
  | 'brand'
  | 'promotion'

// Rotulo exibido ao cliente para cada opcao de ordenacao.
export const catalogSortLabels: Record<CatalogSort, string> = {
  default: 'Ordem do catálogo',
  'price-asc': 'Preco crescente',
  'price-desc': 'Preco decrescente',
  'rating-desc': 'Mais avaliados',
  'date-desc': 'Mais recentes',
  'popularity-desc': 'Mais procurado',
  brand: 'Marca',
  promotion: 'Promocao',
}

// Estado completo dos filtros do catalogo/categoria (entrega, preco, marca, volume e ordenacao).
export type CatalogFilters = {
  pickupOnly: boolean
  minPrice: number | null
  maxPrice: number | null
  brands: string[]
  volumes: string[]
  sort: CatalogSort
}

// Formata o volume em ml para exibicao (hoje so o numero, sem unidade).
export function formatCatalogVolume(volumeMl: number) {
  return `${volumeMl}`
}

// Estado inicial/"sem filtro nenhum", usado ao abrir a pagina e no botao "Limpar filtro".
export const emptyCatalogFilters: CatalogFilters = {
  pickupOnly: false,
  minPrice: null,
  maxPrice: null,
  brands: [],
  volumes: [],
  sort: 'default',
}
