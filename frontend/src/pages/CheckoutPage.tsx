import { initMercadoPago, Payment } from '@mercadopago/sdk-react'
import {
  Check,
  ChevronLeft,
  Copy,
  CreditCard,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { CartSummary } from '../components/CartSummary'
import { EmptyState } from '../components/EmptyState'
import { InputField } from '../components/Field'
import { Reveal } from '../components/Reveal'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type {
  CheckoutConfig,
  CheckoutForm,
  CorreiosOption,
  CustomerProfile,
  ShippingQuote,
} from '../types/checkout'
import {
  CHECKOUT_INITIAL_FORM,
  PAYMENT_METHODS_CONFIG,
  paymentReturnMessage,
  rejectionMessage,
  storeWhatsappMessage,
  validateCheckoutForm,
} from '../utils/checkout'

// Rotulos exibidos na barra de progresso (StepBar) pra cada uma das 4 etapas
const STEP_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Carrinho',
  2: 'Endereço',
  3: 'Entrega',
  4: 'Pagamento',
}

// Pagina de checkout: fluxo de 4 etapas (carrinho -> endereco -> entrega ->
// pagamento) usando o Payment Brick do Mercado Pago, alem da tela de Pix
// (QR Code) quando esse for o metodo escolhido.
export function CheckoutPage() {
  const { items, updateQuantity, removeItem, clearCart } = useCart()
  const { token, scope, isCustomer, requireAuth } = useAuth()
  const format = useCurrency()
  const navigate = useNavigate()
  // Etapa atual do fluxo (1 a 4)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  // Configuracoes da loja vindas do backend: opcoes de frete, chave publica
  // do Mercado Pago e whatsapp de contato
  const [config, setConfig] = useState<CheckoutConfig>({
    shippingOptions: [],
    mpPublicKey: '',
    storeWhatsapp: '',
  })
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  // Dados do formulario de checkout (endereco, contato, cupom, modo de entrega etc)
  const [form, setForm] = useState<CheckoutForm>(CHECKOUT_INITIAL_FORM)
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [couponMessage, setCouponMessage] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponApplied, setCouponApplied] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState('')
  // Opcoes de frete dos Correios cotadas pra esse CEP/peso, e qual delas foi escolhida
  const [correiosOptions, setCorreiosOptions] = useState<CorreiosOption[]>([])
  const [selectedCorreios, setSelectedCorreios] = useState<string>('')
  const [searchParams] = useSearchParams()
  // Dados do QR Code Pix quando o pagamento escolhido gera um Pix (em vez de
  // aprovar na hora via cartao)
  const [pixData, setPixData] = useState<{ orderId: string; qrCode: string; qrCodeBase64: string } | null>(
    null,
  )
  const [pixPaid, setPixPaid] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [approvedOrderId, setApprovedOrderId] = useState('')
  // Controlam o ciclo de vida do Payment Brick: qual "chave" de brick ja
  // ficou pronta (onReady) e qual "chave" estourou o tempo de carregamento
  const [readyBrickKey, setReadyBrickKey] = useState('')
  const [timedOutBrickKey, setTimedOutBrickKey] = useState('')
  // Mensagem de retorno (ex.: vindo de um redirect de pagamento) tem prioridade
  // sobre uma mensagem gerada localmente
  const displayMessage = message || paymentReturnMessage(searchParams.get('status'))
  // Sem conta o checkout nao passa do carrinho, mesmo se o cliente sair da
  // conta no meio do processo.
  const activeStep: 1 | 2 | 3 | 4 = isCustomer ? step : 1

  // Inicializa o SDK do Mercado Pago assim que a chave publica da loja chegar
  useEffect(() => {
    if (config.mpPublicKey) {
      initMercadoPago(config.mpPublicKey, { locale: 'pt-BR' })
    }
  }, [config.mpPublicKey])

  // Enquanto espera a confirmacao de um pagamento Pix, faz polling no pedido
  // a cada 5s pra saber quando o status virou "paid"
  useEffect(() => {
    if (!pixData || pixPaid) return
    const interval = window.setInterval(() => {
      api
        .get<{ paymentStatus: string }>(`/order/${pixData.orderId}`)
        .then((order) => {
          if (order.paymentStatus === 'paid') {
            setPixPaid(true)
          }
        })
        .catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [pixData, pixPaid])

  // Subtotal dos itens do carrinho (sem frete/desconto)
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0),
    [items],
  )
  // Peso total do carrinho, usado pra cotar o frete
  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + item.weightGrams * item.quantity, 0),
    [items],
  )

  const deliveryOptions = config.shippingOptions

  // Garante que o modo de entrega selecionado seja sempre uma opcao valida
  // (cai pra primeira opcao disponivel se o valor salvo no form nao existir mais)
  const deliveryMode = useMemo(
    () =>
      deliveryOptions.some((option) => option.value === form.deliveryMode)
        ? form.deliveryMode
        : (deliveryOptions[0]?.value ?? ''),
    [deliveryOptions, form.deliveryMode],
  )

  // Carrega a configuracao da loja (frete, Mercado Pago, whatsapp) uma vez ao montar
  useEffect(() => {
    api.get<CheckoutConfig>('/store/config').then((data) => {
      setConfig(data)
      setForm((current) => ({
        ...current,
        deliveryMode: current.deliveryMode || data.shippingOptions[0]?.value || '',
      }))
    })
  }, [])

  // Pre-preenche o formulario com os dados e o endereco padrao do cliente
  // logado, assim que a sessao de cliente estiver disponivel
  useEffect(() => {
    if (token && scope === 'customer') {
      api
        .get<CustomerProfile>('/customer/me', token)
        .then((data) => {
          setProfile(data)
          const primaryAddress = data.addresses?.find((address) => address.isDefault) ?? data.addresses?.[0]
          setSelectedAddressId(primaryAddress?.id ?? '')
          setForm((current) => ({
            ...current,
            customerName: data.name,
            customerEmail: data.email,
            confirmEmail: data.email,
            customerPhone: data.phone,
            customerCpf: data.cpf,
            cep: primaryAddress?.cep ?? current.cep,
            street: primaryAddress?.street ?? current.street,
            number: primaryAddress?.number ?? current.number,
            neighborhood: primaryAddress?.neighborhood ?? current.neighborhood,
            city: primaryAddress?.city ?? current.city,
            state: primaryAddress?.state ?? current.state,
          }))
        })
        .catch(() => undefined)
    }
  }, [token, scope])

  // Preenche o formulario com um dos enderecos salvos do cliente, ao
  // selecionar esse endereco na etapa 2
  function applyAddress(addressId: string) {
    if (!profile) return
    const nextAddress = profile.addresses.find((address) => address.id === addressId)
    if (!nextAddress) return

    setSelectedAddressId(addressId)
    setForm((current) => ({
      ...current,
      cep: nextAddress.cep,
      street: nextAddress.street,
      number: nextAddress.number,
      neighborhood: nextAddress.neighborhood,
      city: nextAddress.city,
      state: nextAddress.state,
    }))
  }

  // Cota o frete sempre que o modo de entrega, CEP, cidade, subtotal ou peso
  // mudarem — Correios usa um endpoint proprio que devolve varias opcoes,
  // os demais modos usam uma cotacao unica
  useEffect(() => {
    if (!deliveryMode || !form.cep || subtotal <= 0 || totalWeight <= 0) {
      return
    }

    if (deliveryMode === 'correios') {
      api
        .get<CorreiosOption[]>(`/shipping/correios?cep=${form.cep}&weight=${totalWeight}`)
        .then((options) => {
          setCorreiosOptions(options)
          setSelectedCorreios((current) => current || options[0]?.code || '')
        })
        .catch(() => setCorreiosOptions([]))
      return
    }

    api
      .post<ShippingQuote>('/shipping/quote', {
        cep: form.cep,
        subtotal: subtotal - couponDiscount,
        weightGrams: totalWeight,
        deliveryMode,
        city: form.city,
      })
      .then(setQuote)
      .catch(() => setQuote(null))
  }, [form.cep, deliveryMode, form.city, subtotal, totalWeight, couponDiscount])

  // Normaliza a cotacao de frete ativa num formato unico (amount + label),
  // vindo da opcao de Correios selecionada ou da cotacao simples
  const selectedCorreiosOption = correiosOptions.find((o) => o.code === selectedCorreios)
  const activeQuote =
    deliveryMode === 'correios'
      ? selectedCorreiosOption
        ? { amount: selectedCorreiosOption.price, label: selectedCorreiosOption.label }
        : null
      : deliveryMode && form.cep && subtotal > 0 && totalWeight > 0
        ? quote
        : null
  const total = subtotal - couponDiscount + (activeQuote?.amount ?? 0)
  // Validacao centralizada do formulario (nome, email, endereco etc) usada
  // tanto pra bloquear avanco de etapa quanto pra liberar o Payment Brick
  const validation = validateCheckoutForm(form)
  const missingRequiredFields = !validation.valid
  // Erros de endereco (etapa 2) ignoram o erro de "selecione a entrega", que
  // so faz sentido na etapa 3
  const addressErrors = validation.errors.filter((error) => error !== 'Selecione a entrega')
  const step2Valid = addressErrors.length === 0
  const step3Valid = Boolean(deliveryMode) && (deliveryMode !== 'correios' || Boolean(selectedCorreios))
  // O formulario do Mercado Pago so existe na etapa 4: o contador que avisa
  // "nao foi possivel carregar" precisa nascer junto com ele. Sem o
  // activeStep aqui, a contagem comecava assim que a ficha ficava valida (na
  // etapa do carrinho/endereco) e estourava enquanto o cliente ainda escolhia
  // a entrega - ai a etapa de pagamento ja abria com o erro, sem nunca ter
  // tentado montar o formulario.
  const showBrick = activeStep === 4 && !missingRequiredFields && !!config.mpPublicKey
  const brickKey = showBrick ? total.toFixed(2) : ''
  const brickReady = readyBrickKey === brickKey
  const brickTimedOut = timedOutBrickKey === brickKey

  // Troca de etapa e rola a pagina de volta pro topo, pra sempre comecar a
  // nova etapa visivel (sem isso o usuario ficaria no meio da etapa anterior)
  function goToStep(next: 1 | 2 | 3 | 4) {
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Sair do carrinho exige conta: a janela flutuante cuida do login/cadastro e
  // so depois o checkout avanca para o endereco.
  function handleContinue() {
    const next = (activeStep + 1) as 2 | 3 | 4
    if (activeStep === 1) {
      requireAuth(() => goToStep(2), 'Entre ou cadastre-se para informar o endereco de entrega.')
      return
    }
    goToStep(next)
  }

  useEffect(() => {
    if (!showBrick) return
    // Voltar uma etapa e tentar de novo precisa dar outra chance ao
    // formulario, em vez de repetir o aviso da tentativa anterior.
    setTimedOutBrickKey('')
    const timeout = window.setTimeout(() => setTimedOutBrickKey(brickKey), 15000)
    return () => window.clearTimeout(timeout)
  }, [brickKey, showBrick])

  // Envia o pedido pro backend junto com os dados de pagamento gerados pelo
  // Payment Brick; trata as 3 respostas possiveis: Pix pendente (mostra QR
  // Code), pagamento rejeitado/cancelado (lanca erro pro Brick mostrar), ou
  // aprovado/em analise (limpa o carrinho e mostra mensagem de confirmacao)
  async function handlePayment(brickData: { formData?: unknown }): Promise<void> {
    const formData = (brickData.formData ?? {}) as Record<string, unknown>
    setPaymentError('')
    setLoading(true)
    try {
      const response = await api.post<{
        orderId: string
        total: number
        paymentStatus: string
        orderStatus: string
        discount: number
        shippingAmount: number
        statusDetail?: string
        qrCode?: string
        qrCodeBase64?: string
      }>(
        '/checkout',
        {
          ...form,
          deliveryMode,
          correiosPrice: deliveryMode === 'correios' ? (activeQuote?.amount ?? 0) : 0,
          items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
          paymentMethodId: formData.payment_method_id,
          token: formData.token ?? '',
          issuerId: formData.issuer_id ?? '',
          installments: Number(formData.installments ?? 1),
        },
        token && scope === 'customer' ? token : undefined,
      )

      if (response.qrCode) {
        setPixData({
          orderId: response.orderId,
          qrCode: response.qrCode,
          qrCodeBase64: response.qrCodeBase64 ?? '',
        })
        clearCart()
        return
      }

      if (response.paymentStatus === 'rejected' || response.paymentStatus === 'cancelled') {
        throw new Error(rejectionMessage(response.statusDetail))
      }

      clearCart()
      if (response.paymentStatus === 'approved') {
        setApprovedOrderId(response.orderId)
      }
      setMessage(
        response.paymentStatus === 'approved'
          ? 'Pagamento aprovado! Seu pedido foi confirmado.'
          : 'Pagamento em analise. Voce recebera a confirmacao em breve.',
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao processar pagamento'
      setPaymentError(msg)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Pagamento via Pix gerado: substitui o fluxo normal por uma tela dedicada
  // de QR Code / copia-e-cola ate a confirmacao (ou ja confirmado)
  if (pixData) {
    return (
      <EmptyState
        fullPage
        eyebrow="Pix"
        title={pixPaid ? 'Pagamento confirmado!' : 'Escaneie o QR Code para pagar'}
        description={
          pixPaid
            ? 'Recebemos a confirmacao do seu Pix. Seu pedido ja esta sendo processado.'
            : 'Abra o app do seu banco, escolha pagar com Pix e escaneie o codigo abaixo, ou copie o codigo e cole no app.'
        }
        action={
          // Ja confirmado: oferece contato via whatsapp e volta a loja;
          // ainda pendente: mostra o QR Code e botao de copiar o codigo
          pixPaid ? (
            <div className="flex flex-col items-center gap-3">
              {config.storeWhatsapp ? (
                <a
                  href={`https://wa.me/${config.storeWhatsapp}?text=${encodeURIComponent(
                    storeWhatsappMessage(deliveryMode, pixData.orderId),
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button type="button" variant="secondary">
                    <MessageCircle size={16} /> Falar no WhatsApp
                  </Button>
                </a>
              ) : null}
              <Link to="/">
                <Button>Voltar ao início</Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {pixData.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code Pix"
                  className="h-56 w-56 rounded-[24px] border border-stone-200 bg-white p-3"
                />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(pixData.qrCode).then(() => {
                    setPixCopied(true)
                    window.setTimeout(() => setPixCopied(false), 2000)
                  })
                }}
              >
                <Copy size={16} />
                {pixCopied ? 'Codigo copiado!' : 'Copiar codigo Pix'}
              </Button>
              <p className="text-xs text-[#6b665f]">Aguardando confirmacao do pagamento...</p>
            </div>
          )
        }
      />
    )
  }

  // Carrinho vazio: pode ser porque o cliente ainda nao comprou nada, ou
  // porque o pedido acabou de ser concluido (clearCart esvaziou o carrinho) -
  // displayMessage diferencia os dois casos na tela
  if (items.length === 0) {
    return (
      <EmptyState
        fullPage
        eyebrow="Carrinho vazio"
        title={displayMessage ? 'Pedido concluido' : 'Seu carrinho esta vazio'}
        description={
          displayMessage ||
          'Explore as categorias para adicionar produtos antes de seguir para o checkout.'
        }
        action={
          <div className="flex flex-col items-center gap-3">
            {approvedOrderId && config.storeWhatsapp ? (
              <a
                href={`https://wa.me/${config.storeWhatsapp}?text=${encodeURIComponent(
                  storeWhatsappMessage(deliveryMode, approvedOrderId),
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button type="button" variant="secondary">
                  <MessageCircle size={16} /> Falar no WhatsApp
                </Button>
              </a>
            ) : null}
            <Link to="/">
              <Button>Voltar ao início</Button>
            </Link>
          </div>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <StepBar step={activeStep} />

      <form
        className={`grid gap-6 ${activeStep !== 4 ? 'xl:grid-cols-[1.2fr_0.8fr]' : ''}`}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={`space-y-6 ${activeStep === 4 ? 'mx-auto w-full max-w-2xl' : ''}`}>
          {/* Etapa 1 - Carrinho: lista de itens com controle de quantidade/remocao e campo de cupom */}
          {activeStep === 1 && (
            <Reveal>
              <section className="surface-panel p-5 sm:p-6">
                <h1 className="text-5xl leading-none text-[#2a0f3d]">Seu carrinho</h1>

                <div className="mt-6 space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="surface-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-28 w-full rounded-[24px] object-cover sm:h-24 sm:w-24"
                      />
                      <div className="flex-1">
                        <p className="text-xl font-semibold text-[#2a0f3d]">{item.name}</p>
                        <p className="mt-1 text-sm text-[#6b665f]">
                          {item.brand} • {format(item.finalPrice)}
                        </p>
                        {/* Selo de desconto so aparece quando o item tem um label configurado */}
                        {item.discountLabel ? (
                          <p className="mt-1 text-xs text-[#0f8a5f]">{item.discountLabel}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-2 py-2">
                          <button
                            type="button"
                            aria-label={`Diminuir quantidade de ${item.name}`}
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          >
                            <Minus size={16} />
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Aumentar quantidade de ${item.name}`}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remover ${item.name}`}
                          onClick={() => removeItem(item.id)}
                          className="rounded-full border border-rose-200 p-2 text-rose-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Campo de cupom: valida no backend e aplica o desconto no subtotal */}
                <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <InputField
                    label="Cupom"
                    value={form.couponCode}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, couponCode: event.target.value }))
                    }
                    placeholder="Digite seu cupom"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="self-end"
                    disabled={couponApplied}
                    onClick={async () => {
                      if (!form.couponCode.trim()) {
                        setCouponMessage('Informe um codigo de cupom.')
                        return
                      }
                      try {
                        const result = await api.post<{
                          discount: number
                          discountType: string
                          value: number
                        }>('/store/validate-coupon', { code: form.couponCode, subtotal })
                        setCouponDiscount(result.discount)
                        setCouponApplied(true)
                        setCouponMessage(
                          `Cupom ${form.couponCode.toUpperCase()} aplicado! Desconto: ${format(result.discount)}`,
                        )
                      } catch (err) {
                        setCouponMessage(err instanceof Error ? err.message : 'Cupom invalido')
                        setCouponDiscount(0)
                        setCouponApplied(false)
                      }
                    }}
                  >
                    {couponApplied ? 'Aplicado' : 'Aplicar'}
                  </Button>
                </div>
                {/* Feedback de sucesso/erro da validacao do cupom */}
                {couponMessage ? <p className="mt-2 text-xs text-[#6b665f]">{couponMessage}</p> : null}
              </section>
            </Reveal>
          )}

          {/* Etapa 2 - Endereco: escolhe entre os enderecos salvos do cliente */}
          {activeStep === 2 && (
            <Reveal>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                  Selecione seu endereço
                </p>

                {/* Sem enderecos cadastrados, avisa em vez de mostrar uma lista vazia */}
                {profile && profile.addresses.length > 0 ? (
                  <div className="space-y-2">
                    {profile.addresses.map((address, index) => {
                      const isSelected = selectedAddressId === address.id
                      return (
                        <label
                          key={address.id || `${address.cep}-${index}`}
                          className={`flex cursor-pointer items-center gap-3 rounded-[18px] border p-3.5 transition ${isSelected ? 'border-[#5b247f] bg-[#eadcf0]/50' : 'border-stone-200 bg-white hover:border-[#ddc7ea]'}`}
                        >
                          <input
                            type="radio"
                            name="savedAddress"
                            checked={isSelected}
                            onChange={() => applyAddress(address.id || '')}
                            className="h-4 w-4 shrink-0 accent-[#5b247f]"
                          />
                          <span className="text-sm text-[#2a0f3d]">
                            {address.street}
                            {address.number ? `, ${address.number}` : ''} - {address.city}, {address.state},
                            CEP {address.cep}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#6b665f]">Nenhum endereço cadastrado.</p>
                )}
              </section>
            </Reveal>
          )}

          {/* Etapa 3 - Entrega: escolhe o modo de envio e, se for Correios,
              qual das opcoes cotadas usar */}
          {activeStep === 3 && (
            <Reveal>
              <section className="surface-panel p-5 sm:p-6">
                <h1 className="text-4xl leading-none text-[#2a0f3d]">Forma de entrega</h1>

                <div className="mt-6 space-y-3">
                  {deliveryOptions.map((option) => {
                    const isSelected = deliveryMode === option.value
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border p-4 transition ${isSelected ? 'border-[#5b247f] bg-[#eadcf0]/50' : 'border-stone-200 bg-white hover:border-[#ddc7ea]'}`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="deliveryMode"
                            value={option.value}
                            checked={isSelected}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, deliveryMode: event.target.value }))
                            }
                            className="h-4 w-4 accent-[#5b247f]"
                          />
                          <span className="text-sm font-semibold text-[#2a0f3d]">{option.label}</span>
                        </span>
                        {/* So mostra o preco quando essa opcao esta selecionada e ja ha cotacao */}
                        {isSelected && activeQuote ? (
                          <span className="text-sm font-semibold text-[#3a164f]">
                            {format(activeQuote.amount)}
                          </span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>

                {/* Sub-lista de opcoes dos Correios, so quando esse modo foi escolhido e ja ha cotacoes */}
                {deliveryMode === 'correios' && correiosOptions.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    <p className="eyebrow">Opção dos Correios</p>
                    {correiosOptions.map((option) => {
                      const isSelected = selectedCorreios === option.code
                      return (
                        <label
                          key={option.code}
                          className={`flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border p-4 transition ${isSelected ? 'border-[#5b247f] bg-[#eadcf0]/50' : 'border-stone-200 bg-white hover:border-[#ddc7ea]'}`}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="correiosOption"
                              value={option.code}
                              checked={isSelected}
                              onChange={() => setSelectedCorreios(option.code)}
                              className="h-4 w-4 accent-[#5b247f]"
                            />
                            <span className="text-sm font-semibold text-[#2a0f3d]">{option.label}</span>
                          </span>
                          <span className="text-sm font-semibold text-[#3a164f]">{format(option.price)}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            </Reveal>
          )}

          {/* Etapa 4 - Revisao: resume endereco e entrega escolhidos antes do
              formulario de pagamento (renderizado no bloco Reveal seguinte) */}
          {activeStep === 4 && (
            <Reveal>
              <section className="surface-panel p-5 sm:p-6">
                <h1 className="text-4xl leading-none text-[#2a0f3d]">Revise e pague</h1>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="surface-soft p-4">
                    <p className="eyebrow mb-1">Endereço de entrega</p>
                    {/* So mostra os dados se pelo menos um campo de endereco foi preenchido */}
                    {form.street || form.number || form.cep ? (
                      <>
                        <p className="text-sm text-[#2a0f3d]">
                          {form.street}
                          {form.number ? `, ${form.number}` : ''}
                          {form.neighborhood ? ` - ${form.neighborhood}` : ''}
                        </p>
                        <p className="text-sm text-[#6b665f]">
                          {form.city} - {form.state}
                          {form.cep ? ` · CEP ${form.cep}` : ''}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-[#6b665f]">Não informado</p>
                    )}
                  </div>
                  <div className="surface-soft p-4">
                    <p className="eyebrow mb-1">Entrega escolhida</p>
                    <p className="text-sm text-[#2a0f3d]">
                      {deliveryOptions.find((option) => option.value === deliveryMode)?.label ||
                        activeQuote?.label ||
                        'Selecione na etapa anterior'}
                    </p>
                    {activeQuote ? (
                      <p className="text-sm text-[#6b665f]">{format(activeQuote.amount)}</p>
                    ) : null}
                  </div>
                </div>

                {/* Mensagem de retorno (ex.: redirect de pagamento anterior) */}
                {displayMessage ? (
                  <p className="mt-5 rounded-[22px] border border-stone-200 bg-[#eadcf0] px-4 py-3 text-sm text-[#6b665f]">
                    {displayMessage}
                  </p>
                ) : null}
              </section>
            </Reveal>
          )}

          {/* Payment Brick do Mercado Pago, com os estados de bloqueio
              possiveis antes dele poder aparecer: dados invalidos, loja sem
              pagamento online configurado, ou timeout de carregamento */}
          {activeStep === 4 ? (
            <Reveal delay={60}>
              <div className="space-y-4">
                {missingRequiredFields ? (
                  <p className="rounded-[22px] border border-stone-200 bg-[#eadcf0] px-4 py-3 text-center text-sm text-[#6b665f]">
                    Volte e preencha seus dados e endereco para escolher a forma de pagamento.
                  </p>
                ) : !config.mpPublicKey ? (
                  <p className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-[#6b665f]">
                    Pagamento online indisponivel no momento. Entre em contato para finalizar seu pedido.
                  </p>
                ) : brickTimedOut && !brickReady ? (
                  <p className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-600">
                    Nao foi possivel carregar o formulario de pagamento. Verifique sua conexao e recarregue a
                    pagina.
                  </p>
                ) : (
                  <div
                    className={`surface-panel overflow-hidden p-2 ${loading ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    {/* Trava cliques no Brick enquanto o pagamento esta sendo processado */}
                    {loading ? (
                      <p className="px-4 pt-3 text-center text-xs font-medium text-[#6b665f]">
                        Processando pagamento...
                      </p>
                    ) : null}
                    {/* Aviso de carregamento ate o Brick disparar onReady */}
                    {!brickReady ? (
                      <p className="px-4 pt-3 text-center text-xs font-medium text-[#6b665f]">
                        Carregando formulario de pagamento...
                      </p>
                    ) : null}
                    <Payment
                      key={brickKey}
                      initialization={{ amount: total }}
                      customization={{ paymentMethods: PAYMENT_METHODS_CONFIG }}
                      onSubmit={handlePayment}
                      onReady={() => setReadyBrickKey(brickKey)}
                      onError={(error) =>
                        setPaymentError(
                          error instanceof Error ? error.message : 'Erro ao carregar o pagamento',
                        )
                      }
                      locale="pt-BR"
                    />
                  </div>
                )}

                {/* Erro de pagamento (rejeitado, cancelado, falha ao enviar) */}
                {paymentError ? (
                  <p className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {paymentError}
                  </p>
                ) : null}
              </div>
            </Reveal>
          ) : null}

          {/* Botao de voltar so na etapa de pagamento (as outras etapas usam
              o botao Voltar do resumo lateral) */}
          {activeStep === 4 ? (
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="secondary" onClick={() => goToStep(3)}>
                <ChevronLeft size={16} /> Voltar
              </Button>
            </div>
          ) : null}
        </div>

        {/* O resumo acompanha carrinho, endereco e entrega; na etapa de pagamento a tela e unica. */}
        {activeStep !== 4 ? (
          <Reveal delay={120}>
            <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <CartSummary
                subtotal={subtotal}
                shipping={activeQuote?.amount ?? 0}
                shippingLabel={activeQuote?.label || 'Frete'}
                discount={couponDiscount}
                total={total}
                couponCode={form.couponCode}
              />
              <div className="surface-panel space-y-3 p-5">
                <Button
                  type="button"
                  fullWidth
                  disabled={(activeStep === 2 && !step2Valid) || (activeStep === 3 && !step3Valid)}
                  onClick={handleContinue}
                >
                  Continuar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => (activeStep === 1 ? navigate(-1) : goToStep((activeStep - 1) as 1 | 2))}
                >
                  Voltar
                </Button>
              </div>
            </div>
          </Reveal>
        ) : null}
      </form>
    </div>
  )
}

// Barra de progresso com os 4 passos do checkout, no topo da pagina
function StepBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [1, 2, 3, 4] as const
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((item, index) => {
        const isActive = step === item
        const isDone = step > item
        const Icon = item === 1 ? ShoppingBag : item === 2 ? MapPin : item === 3 ? Truck : CreditCard
        return (
          <li key={item} className="flex items-center gap-2 sm:gap-4">
            {/* Linha conectora entre os icones; nao mostra antes do primeiro passo */}
            {index > 0 ? (
              <span
                className={`h-0.5 w-6 rounded-full sm:w-12 ${isDone || isActive ? 'bg-[#5b247f]' : 'bg-stone-200'}`}
              />
            ) : null}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                  isActive
                    ? 'border-[#5b247f] bg-[#5b247f] text-white'
                    : isDone
                      ? 'border-[#5b247f] bg-[#eadcf0] text-[#5b247f]'
                      : 'border-stone-200 bg-white text-stone-400'
                }`}
              >
                {isDone ? <Check size={16} /> : <Icon size={16} />}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${isActive || isDone ? 'text-[#3a164f]' : 'text-stone-400'}`}
              >
                {STEP_LABELS[item]}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
