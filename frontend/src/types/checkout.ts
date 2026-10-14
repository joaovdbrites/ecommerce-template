import type { CustomerAddress } from './index'

export type CheckoutConfig = {
  shippingOptions: Array<{ value: string; label: string }>
  mpPublicKey: string
  storeWhatsapp: string
}

export type CustomerProfile = {
  name: string
  email: string
  phone: string
  cpf: string
  addresses: CustomerAddress[]
}

export type ShippingQuote = {
  amount: number
  label: string
}

export type CorreiosOption = {
  service: string
  code: string
  price: number
  days: number
  label: string
}

export type CheckoutForm = {
  customerName: string
  customerEmail: string
  confirmEmail: string
  customerPhone: string
  customerCpf: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  deliveryMode: string
  couponCode: string
}
