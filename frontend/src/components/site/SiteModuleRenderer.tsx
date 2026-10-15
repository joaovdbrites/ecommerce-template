import type { ItemCardContent } from '../item/ItemCard'
import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import { BrandMarquee } from '../BrandMarquee'
import { getRenderableOrganizerItems, isSiteModuleRenderable, toItemContent } from './moduleContent'
import { CarouselModule } from '../../pages/modelos/CarouselModule'
import { CatalogModule } from '../../pages/modelos/CatalogModule'
import { HighlightModule } from '../../pages/modelos/HighlightModule'

type SiteModuleRendererProps = {
  module: OrganizerNode
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  brands?: string[]
  previewMode?: boolean
  /**
   * Itens calculados automaticamente por regra (ex.: Produtos em oferta,
   * Pouco no estoque) para carrosseis da home. Entram sempre depois dos
   * itens escolhidos manualmente no Organizador.
   */
  autoItems?: ItemCardContent[]
}

// Ponte entre um no do Organizador e o componente visual que de fato o
// renderiza no site publico (CarouselModule, CatalogModule ou
// HighlightModule), escolhendo qual deles usar a partir do tipo/variante do
// no e montando a lista final de itens (manuais + automaticos).
export function SiteModuleRenderer({
  module,
  nodes,
  tags,
  brands = [],
  previewMode = false,
  autoItems,
}: SiteModuleRendererProps) {
  // Mesmo um modulo sem itens escolhidos manualmente pode ser renderizado se
  // tiver itens automaticos (ex.: carrossel "Novidades" da home).
  const hasAutoItems = Boolean(autoItems?.length)
  if (!isSiteModuleRenderable(module, nodes, brands, previewMode) && !hasAutoItems) return null

  const selectedItems = getRenderableOrganizerItems(module, nodes, previewMode)
  const manualItemCards = selectedItems.map((node) => toItemContent(node, tags))
  const manualIds = new Set(manualItemCards.map((item) => item.id))
  // Itens automaticos entram depois dos escolhidos manualmente, sem repetir
  // um item que ja esteja na selecao manual.
  const itemCards = autoItems
    ? [...manualItemCards, ...autoItems.filter((item) => !manualIds.has(item.id))]
    : manualItemCards

  // Faixa de marcas em destaque (marquee), sem relacao com os itemCards acima.
  if (module.variant === 'brand-marquee') {
    return <BrandMarquee brands={brands} />
  }

  // Banner de destaque, com imagem e texto, sem lista de produtos.
  if (module.type === 'highlight' || module.variant === 'banner') {
    return <HighlightModule module={module} />
  }

  // Grade paginada de produtos (modelo das categorias).
  if (module.type === 'catalog' || module.variant === 'product-grid') {
    return <CatalogModule module={module} items={itemCards} />
  }

  // Caso padrao: faixa deslizante de itens (ou banners, se variant for banner-carousel).
  return <CarouselModule module={module} items={itemCards} />
}
