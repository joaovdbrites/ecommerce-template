import type { OrganizerStatus } from './organizer'

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

export type CartItem = Product & {
  quantity: number
}

export type SelectOption = {
  id: string
  name: string
}

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

export type CustomerOrderItem = {
  name: string
  price: number
  quantity: number
  imageUrl: string
}

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
