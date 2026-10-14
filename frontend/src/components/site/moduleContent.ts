import { isOrganizerNodeAvailable } from '../../types/organizer'
import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import type { ItemCardContent } from '../item/ItemCard'

export function toItemContent(node: OrganizerNode, tags: OrganizerTag[]): ItemCardContent {
  const firstTag = tags.find((tag) => node.tagIds.includes(tag.id))
  return {
    id: node.id,
    name: node.name,
    description: node.description,
    imageUrl: node.imageUrl,
    images: node.images,
    price: node.price,
    tagLabel: firstTag?.name,
    createdAt: node.createdAt,
    sku: node.sku,
    brand: node.brand,
    volumeMl: node.volumeMl,
    stock: node.stock,
    pixDiscountPercent: node.pixDiscountPercent,
    status: node.status,
  }
}

export function getRenderableOrganizerItems(
  module: OrganizerNode,
  nodes: OrganizerNode[],
  previewMode: boolean,
) {
  return module.itemIds
    .map((id) =>
      nodes.find(
        (node) => node.id === id && node.type === 'item' && isOrganizerNodeAvailable(node, previewMode),
      ),
    )
    .filter((node): node is OrganizerNode => Boolean(node))
}

export function isSiteModuleRenderable(
  module: OrganizerNode,
  nodes: OrganizerNode[],
  brands: string[] = [],
  previewMode = false,
) {
  // Um item só aparece na página quando está vinculado a um Carrossel ou
  // Catálogo (via itemIds) - um item solto na página, sem estar dentro de
  // um desses, não deve ser exibido por conta própria.
  if (module.type === 'item') return false
  if (module.variant === 'brand-marquee') return brands.length > 0
  if (module.type === 'highlight' || module.variant === 'banner') {
    return Boolean(module.imageUrl.trim())
  }

  const hasSelectedItems = getRenderableOrganizerItems(module, nodes, previewMode).length > 0
  if (module.variant === 'banner-carousel') {
    return hasSelectedItems || Boolean(module.imageUrl.trim())
  }

  if (module.type === 'carousel' || module.type === 'catalog') return hasSelectedItems
  return false
}
