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

export function SiteModuleRenderer({
  module,
  nodes,
  tags,
  brands = [],
  previewMode = false,
  autoItems,
}: SiteModuleRendererProps) {
  const hasAutoItems = Boolean(autoItems?.length)
  if (!isSiteModuleRenderable(module, nodes, brands, previewMode) && !hasAutoItems) return null

  const selectedItems = getRenderableOrganizerItems(module, nodes, previewMode)
  const manualItemCards = selectedItems.map((node) => toItemContent(node, tags))
  const manualIds = new Set(manualItemCards.map((item) => item.id))
  const itemCards = autoItems
    ? [...manualItemCards, ...autoItems.filter((item) => !manualIds.has(item.id))]
    : manualItemCards

  if (module.variant === 'brand-marquee') {
    return <BrandMarquee brands={brands} />
  }

  if (module.type === 'highlight' || module.variant === 'banner') {
    return <HighlightModule module={module} />
  }

  if (module.type === 'catalog' || module.variant === 'product-grid') {
    return <CatalogModule module={module} items={itemCards} />
  }

  return <CarouselModule module={module} items={itemCards} />
}
