import type { CustomerAddress } from './index'

// Configuracao da pagina de checkout vinda do backend: opcoes de entrega
// disponiveis e chave publica do Mercado Pago para montar o form de cartao.
export type CheckoutConfig = {
  shippingOptions: Array<{ value: string; label: string }>
  mpPublicKey: string
  storeWhatsapp: string
}

// Dados do cliente logado usados para pre-preencher o checkout.
export type CustomerProfile = {
  name: string
  email: string
  phone: string
  cpf: string
  addresses: CustomerAddress[]
}

// Cotacao de frete simples (um unico valor/rotulo), usada quando nao ha
// integracao com os Correios.
export type ShippingQuote = {
  amount: number
  label: string
}

// Uma opcao de frete retornada pela cotacao dos Correios (PAC/SEDEX etc.).
export type CorreiosOption = {
  service: string
  code: string
  price: number
  days: number
  label: string
}

// Estado do formulario de checkout preenchido pelo cliente.
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
