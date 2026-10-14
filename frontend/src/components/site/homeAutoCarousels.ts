import type { ItemCardContent } from '../item/ItemCard'
import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import { isOrganizerNodeAvailable } from '../../types/organizer'
import { toItemContent } from './moduleContent'

/** Teto de itens calculados automaticamente por carrossel da home. Itens
 * escolhidos na mao no Organizador ("Aparece em") nao entram nessa conta. */
const AUTO_CAROUSEL_LIMIT = 6

/** Carrosseis fixos da home (ver homeModuleNames em types/organizer.ts) que
 * ganham complemento automatico por regra. Os outros (Visto recentemente,
 * Recomendado, Mais procurados) continuam so na curadoria manual ate a
 * personalizacao entrar numa proxima etapa. */
const AUTO_CAROUSEL_MODULE_IDS = {
  newArrivals: 'home-products-2',
  onSale: 'home-products-4',
  lowStock: 'home-products-6',
} as const

function bestDiscountPercent(node: OrganizerNode, tags: OrganizerTag[]) {
  return node.tagIds.reduce((best, tagId) => {
    const percent = tags.find((tag) => tag.id === tagId)?.discountPercent ?? 0
    return percent > best ? percent : best
  }, 0)
}

/**
 * Complemento automatico dos carrosseis fixos da home, calculado direto do
 * Organizador (antes vinha da tabela "products", que saiu de cena). Um mesmo
 * item nunca aparece em dois carrosseis automaticos: a prioridade e
 * oferta > pouco estoque > novidades.
 */
export function getHomeAutoItems(
  nodes: OrganizerNode[],
  tags: OrganizerTag[],
  previewMode = false,
): Record<string, ItemCardContent[]> {
  const available = nodes.filter(
    (node) => node.type === 'item' && isOrganizerNodeAvailable(node, previewMode),
  )

  const used = new Set<string>()
  const take = (list: OrganizerNode[]) => {
    const picked: ItemCardContent[] = []
    for (const node of list) {
      if (used.has(node.id)) continue
      used.add(node.id)
      picked.push(toItemContent(node, tags))
      if (picked.length >= AUTO_CAROUSEL_LIMIT) break
    }
    return picked
  }

  const onSale = take(
    available
      .filter((node) => bestDiscountPercent(node, tags) > 0)
      .sort((a, b) => bestDiscountPercent(b, tags) - bestDiscountPercent(a, tags)),
  )

  // No Organizador quem marca "pouco no estoque" e o proprio status do item
  // (o estoque zerado vira "coming-soon" sozinho no checkout), entao a regra
  // aqui e so ler esse status em vez de comparar com um estoque cadastrado.
  const lowStock = take(available.filter((node) => node.status === 'low-stock'))

  const newArrivals = take(
    [...available].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )

  const result: Record<string, ItemCardContent[]> = {}
  if (onSale.length) result[AUTO_CAROUSEL_MODULE_IDS.onSale] = onSale
  if (lowStock.length) result[AUTO_CAROUSEL_MODULE_IDS.lowStock] = lowStock
  if (newArrivals.length) result[AUTO_CAROUSEL_MODULE_IDS.newArrivals] = newArrivals
  return result
}

/** Marcas da faixa "Marcas em destaque", tiradas dos proprios itens do
 * Organizador (antes vinham dos produtos em destaque do catalogo antigo). */
export function getOrganizerBrands(nodes: OrganizerNode[], previewMode = false) {
  const brands = nodes
    .filter((node) => node.type === 'item' && isOrganizerNodeAvailable(node, previewMode))
    .map((node) => node.brand?.trim())
    .filter((brand): brand is string => Boolean(brand))
  return Array.from(new Set(brands))
}
