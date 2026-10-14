import type { CheckoutForm } from '../types/checkout'

export const CHECKOUT_INITIAL_FORM: CheckoutForm = {
  customerName: '',
  customerEmail: '',
  confirmEmail: '',
  customerPhone: '',
  customerCpf: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  deliveryMode: '',
  couponCode: '',
}

export const PAYMENT_METHODS_CONFIG = {
  creditCard: 'all',
  bankTransfer: 'all',
  debitCard: [],
  ticket: [],
  mercadoPago: [],
  atm: [],
  prepaidCard: [],
  maxInstallments: 12,
}

/** Telefone salvo sem DDI (so DDD+numero) ganha o 55 do Brasil pro link do wa.me funcionar. */
export function toWhatsappDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return digits.length <= 11 ? `55${digits}` : digits
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function rejectionMessage(detail?: string): string {
  const reasons: Record<string, string> = {
    cc_rejected_insufficient_amount: 'Saldo insuficiente no cartao.',
    cc_rejected_bad_filled_security_code: 'Codigo de seguranca (CVV) invalido.',
    cc_rejected_bad_filled_date: 'Data de validade invalida.',
    cc_rejected_bad_filled_card_number: 'Numero do cartao invalido.',
    cc_rejected_bad_filled_other: 'Confira os dados do cartao e tente novamente.',
    cc_rejected_call_for_authorize: 'Cartao requer autorizacao. Entre em contato com o banco emissor.',
    cc_rejected_card_disabled: 'Cartao desabilitado. Entre em contato com o banco emissor.',
    cc_rejected_duplicated_payment: 'Pagamento duplicado para esse pedido.',
    cc_rejected_high_risk: 'Pagamento recusado por seguranca.',
    cc_rejected_max_attempts: 'Numero maximo de tentativas excedido. Tente outro cartao.',
    cc_rejected_other_reason: 'Pagamento recusado pelo banco emissor.',
  }

  return (detail && reasons[detail]) || 'Pagamento recusado. Verifique os dados do cartao ou tente Pix.'
}

/** Mensagem pronta pro cliente abrir o WhatsApp da loja depois do pagamento. */
export function storeWhatsappMessage(deliveryMode: string, orderId: string): string {
  const orderRef = orderId ? ` (pedido ${orderId.slice(0, 8)})` : ''
  return deliveryMode === 'pickup'
    ? `Ola! Acabei de finalizar um pedido${orderRef} e vou retirar na loja. Podemos combinar o horario?`
    : `Ola! Acabei de finalizar um pedido${orderRef} para entrega. Podemos combinar os detalhes?`
}

export function paymentReturnMessage(status: string | null) {
  if (status === 'success') return 'Pagamento aprovado! Seu pedido está sendo processado.'
  if (status === 'failure') return 'Pagamento recusado. Tente novamente.'
  if (status === 'pending') return 'Pagamento pendente. Aguardando confirmação.'
  return ''
}

export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Fraca', color: 'text-rose-500' }
  if (score <= 2) return { score, label: 'Media', color: 'text-amber-500' }
  if (score <= 3) return { score, label: 'Boa', color: 'text-emerald-500' }
  return { score, label: 'Forte', color: 'text-emerald-600' }
}

export function validateCheckoutForm(form: CheckoutForm) {
  const errors: string[] = []

  if (!form.customerName.trim()) errors.push('Nome obrigatorio')
  if (!form.customerEmail.trim() || !form.customerEmail.includes('@')) errors.push('Email invalido')
  if (form.customerEmail !== form.confirmEmail) errors.push('Emails nao conferem')
  if (!form.customerPhone.replace(/\D/g, '')) errors.push('Telefone obrigatorio')

  const cpf = form.customerCpf.replace(/\D/g, '')
  if (!cpf) errors.push('CPF obrigatorio')
  else if (!isValidCPF(cpf)) errors.push('CPF invalido')

  // Endereco temporariamente opcional no checkout.
  if (!form.deliveryMode) errors.push('Selecione a entrega')

  return { valid: errors.length === 0, errors }
}

function isValidCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false

  for (let position = 9; position <= 10; position++) {
    let sum = 0
    for (let index = 0; index < position; index++) {
      sum += Number(cpf[index]) * (position + 1 - index)
    }

    const digit = ((sum * 10) % 11) % 10
    if (digit !== Number(cpf[position])) return false
  }

  return true
}
