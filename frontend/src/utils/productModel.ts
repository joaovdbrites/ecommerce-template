import type { ItemCardContent } from '../components/item/ItemCard'
import type { Product } from '../types'

/** Converte um produto do catalogo real para o formato usado pelos cards dos carrosseis. */
export function productToItemCardContent(product: Product): ItemCardContent {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    images: product.images,
    price: product.finalPrice,
    tagLabel: product.discountLabel || undefined,
    createdAt: product.createdAt,
    sku: product.sku,
    brand: product.brand,
    volumeMl: product.volumeMl,
    stock: product.stockCurrent,
    pixDiscountPercent: product.pixDiscountPercent,
    status: product.status,
  }
}

// Converte um item do Organizador (formato enxuto do card) de volta para o
// formato Product completo, preenchendo com valores neutros os campos que o
// Organizador nao tem (categoria, margem, estoque minimo etc.) - e o que
// permite reusar componentes de carrinho/checkout escritos para o catalogo
// real tambem com produtos vindos do Organizador.
export function itemCardToProduct(item: ItemCardContent): Product {
  const price = item.price || 0
  // Itens sem campo de estoque preenchido sao tratados como "sempre
  // disponiveis" (999 unidades fakes) em vez de forcar um controle de
  // estoque que o lojista nao configurou para aquele item.
  const hasStockTracking = item.stock !== undefined
  return {
    id: item.id,
    sku: item.sku || item.id,
    name: item.name,
    slug: item.id,
    brand: item.brand || '',
    category: '',
    description: item.description || '',
    salePrice: price,
    promotionalPrice: null,
    finalPrice: price,
    automaticDiscountAmount: 0,
    discountLabel: '',
    costPrice: 0,
    profitMargin: 0,
    stockCurrent: hasStockTracking ? Math.max(0, item.stock ?? 0) : 999,
    stockMinimum: 0,
    registeredStock: hasStockTracking ? Math.max(0, item.stock ?? 0) : 999,
    // Organizador nao tem campo de peso dedicado - usa o atributo numerico
    // (quando preenchido) como aproximacao em gramas e cai num valor minimo
    // de seguranca sem isso, senao o frete fica de graca (mesma regra usada
    // no calculo do pedido no backend).
    weightGrams: item.volumeMl && item.volumeMl > 0 ? item.volumeMl : 200,
    volumeMl: item.volumeMl || 0,
    gender: '',
    productType: '',
    imageUrl: item.imageUrl || '',
    images: item.images?.length ? item.images : item.imageUrl ? [item.imageUrl] : [],
    isActive: true,
    isFeatured: false,
    isAvailable: !hasStockTracking || (item.stock ?? 0) > 0,
    pixDiscountPercent: item.pixDiscountPercent,
    status: item.status,
  }
}
