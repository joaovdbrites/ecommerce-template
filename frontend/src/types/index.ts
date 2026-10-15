import type { OrganizerStatus } from './organizer'

// Representa um produto pronto para exibicao/venda, seja ele vindo do
// catalogo real (gestao de estoque tradicional) ou de um item do Organizador
// (ver utils/productModel.ts para a conversao entre os dois formatos).
export type Product = {
  id: string
  sku: string
  name: string
  slug: string
  brandId?: string
  brand: string
  categoryId?: string
  category: string
  description: string
  salePrice: number
  promotionalPrice?: number | null
  finalPrice: number
  automaticDiscountAmount: number
  discountLabel: string
  costPrice: number
  profitMargin: number
  stockCurrent: number
  stockMinimum: number
  registeredStock: number
  weightGrams: number
  volumeMl: number
  gender: string
  productType: string
  imageUrl: string
  images: string[]
  isActive: boolean
  isFeatured: boolean
  isAvailable: boolean
  /** Desconto no Pix em %, por produto. Sem valor, a pagina usa o padrao do site. */
  pixDiscountPercent?: number
  createdAt?: string
  /** So existe pra itens vindos do Organizador - produtos do catalogo real nao tem. */
  status?: OrganizerStatus
}

// Um produto dentro do carrinho, com a quantidade escolhida pelo cliente.
export type CartItem = Product & {
  quantity: number
}

// Par generico id/nome usado para popular selects (ex.: filtros de marca/categoria).
export type SelectOption = {
  id: string
  name: string
}

// Endereco de entrega salvo no cadastro do cliente.
export type CustomerAddress = {
  id?: string
  label?: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  isDefault?: boolean
}

// Pedido resumido para a listagem "Meus pedidos" do cliente.
export type CustomerOrder = {
  id: string
  total: number
  paymentStatus: string
  orderStatus: string
  createdAt: string
  previewName?: string
  previewImageUrl?: string
  itemCount?: number
}

// Um item de linha dentro do detalhe de um pedido.
export type CustomerOrderItem = {
  name: string
  price: number
  quantity: number
  imageUrl: string
}

// Detalhe completo de um pedido (tela de acompanhamento do cliente), com
// itens, endereco de entrega e o resumo de valores.
export type CustomerOrderDetail = {
  id: string
  total: number
  subtotal: number
  paymentStatus: string
  orderStatus: string
  paymentMethod: string
  createdAt: string
  shipping: number
  discount: number
  address: {
    label: string
    street: string
    number: string
    neighborhood: string
    city: string
    state: string
    cep: string
  }
  items: CustomerOrderItem[]
}
