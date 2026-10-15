import { isOrganizerNodeAvailable } from '../../types/organizer'
import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import type { ItemCardContent } from '../item/ItemCard'

// Converte um no do tipo "item" do Organizador no formato enxuto que o
// ItemCard espera para renderizar, resolvendo a primeira tag vinculada ao
// item para extrair o rotulo exibido (ex.: nome do desconto).
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

// Resolve os itemIds de um carrossel/catalogo para os nos reais, mantendo
// a ordem escolhida pelo admin e descartando itens que nao existem mais ou
// que nao estao disponiveis para exibicao (rascunho fora do Modo visitante).
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

// Decide se um modulo deve ser renderizado na pagina publica, de acordo com
// o tipo/variante dele e se ha conteudo suficiente (itens ou imagem) para
// mostrar algo util - evita secoes vazias no site.
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
  // Marquee de marcas so aparece quando ha ao menos uma marca para mostrar.
  if (module.variant === 'brand-marquee') return brands.length > 0
  // Destaque/banner so precisa ter uma imagem definida.
  if (module.type === 'highlight' || module.variant === 'banner') {
    return Boolean(module.imageUrl.trim())
  }

  const hasSelectedItems = getRenderableOrganizerItems(module, nodes, previewMode).length > 0
  // Carrossel de banners pode viver so da imagem de capa do proprio modulo,
  // mesmo sem nenhum item selecionado.
  if (module.variant === 'banner-carousel') {
    return hasSelectedItems || Boolean(module.imageUrl.trim())
  }

  if (module.type === 'carousel' || module.type === 'catalog') return hasSelectedItems
  return false
}
