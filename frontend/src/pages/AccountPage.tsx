import type { FormEvent, ReactNode } from 'react'
import { MapPin, Package, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { InputField } from '../components/Field'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { CustomerAddress, CustomerOrder } from '../types'

type Profile = {
  name: string
  email: string
  phone: string
  cpf: string
  addresses: CustomerAddress[]
  orders: CustomerOrder[]
}

type AccountTab = 'profile' | 'addresses' | 'orders'

type AddressForm = {
  addressId: string
  addressLabel: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  isDefault: boolean
}

const emptyAddressForm: AddressForm = {
  addressId: '',
  addressLabel: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: 'Campo Grande',
  state: 'MS',
  isDefault: false,
}

export function AccountPage() {
  const { token, scope, logout, openAuth } = useAuth()
  const format = useCurrency()
  const [searchParams] = useSearchParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  // Permite abrir direto numa aba especifica (ex.: /conta?tab=addresses), usado
  // pelo menu da conta no rodape mobile.
  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<AccountTab>(
    requestedTab === 'addresses' || requestedTab === 'orders' ? requestedTab : 'profile',
  )
  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddressForm)
  const [addressSaving, setAddressSaving] = useState(false)

  useEffect(() => {
    if (token && scope === 'customer') {
      api
        .get<Profile>('/customer/me', token)
        .then(setProfile)
        .catch(() => undefined)
    }
  }, [token, scope])

  if (!token || scope !== 'customer') {
    return (
      <section className="surface-panel p-6 sm:p-8">
        <h1 className="text-5xl leading-none text-[#2a0f3d]">Minha conta</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6b665f]">
          Entre como cliente para acompanhar pedidos, salvar enderecos e manter um checkout mais rapido nas
          proximas compras.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={() => openAuth({ reason: 'Entre para ver seus pedidos e enderecos.' })}>
            Entrar
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => openAuth({ view: 'register', reason: 'Preencha sua ficha de cadastro.' })}
          >
            Criar cadastro
          </Button>
        </div>
      </section>
    )
  }

  if (!profile) {
    return <Skeleton className="h-[420px] w-full rounded-[36px]" />
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const formData = new FormData(event.currentTarget)
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.put<Profile>(
        '/customer/me',
        {
          name: String(formData.get('name')),
          email: String(formData.get('email')),
          phone: String(formData.get('phone')),
          cpf: String(formData.get('cpf') || ''),
        },
        token,
      )
      setProfile(updated)
      setMessage('Perfil atualizado com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setAddressSaving(true)
    setMessage('')

    try {
      const updated = await api.post<Profile>('/customer/addresses', addressForm, token)
      setProfile(updated)
      setAddressForm(emptyAddressForm)
      setMessage('Endereco salvo com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar endereco')
    } finally {
      setAddressSaving(false)
    }
  }

  async function makeDefaultAddress(addressId: string) {
    if (!token) return
    setMessage('')

    try {
      const updated = await api.put<Profile>(`/customer/addresses/${addressId}/default`, {}, token)
      setProfile(updated)
      setMessage('Endereco padrao atualizado com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao definir endereco padrao')
    }
  }

  const tabs: Array<{ id: AccountTab; label: string; icon: ReactNode }> = [
    { id: 'profile', label: 'Perfil', icon: <UserRound size={16} /> },
    { id: 'addresses', label: 'Enderecos', icon: <MapPin size={16} /> },
    { id: 'orders', label: 'Pedidos', icon: <Package size={16} /> },
  ]

  return (
    <div className="space-y-6">
      <Reveal>
        <section className="surface-panel p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Minha conta</p>
              <h1 className="mt-3 text-5xl leading-none text-[#2a0f3d]">{profile.name}</h1>
              <p className="mt-3 text-sm leading-7 text-[#6b665f]">
                {profile.email} • {profile.phone}
              </p>
            </div>
            <Button variant="secondary" onClick={logout}>
              Sair
            </Button>
          </div>
        </section>
      </Reveal>

      <div className="surface-panel overflow-hidden p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold',
                activeTab === tab.id ? 'bg-[#2a0f3d] text-[#f8f5f9]' : 'bg-[#eadcf0] text-[#6b665f]',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'profile' ? (
        <section className="surface-panel p-6">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
            <InputField name="name" label="Nome" defaultValue={profile.name} required />
            <InputField name="email" label="E-mail" type="email" defaultValue={profile.email} required />
            <InputField name="phone" label="Telefone" defaultValue={profile.phone} required />
            <InputField name="cpf" label="CPF" defaultValue={profile.cpf} />
            <div className="md:col-span-2">
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar perfil'}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === 'addresses' ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {profile.addresses.length === 0 ? (
              <EmptyState
                eyebrow="Enderecos"
                title="Nenhum endereco salvo"
                description="Cadastre o primeiro endereco para agilizar seu checkout."
              />
            ) : (
              profile.addresses.map((address, index) => (
                <div key={`${address.id ?? address.cep}-${index}`} className="surface-panel p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-3xl text-[#2a0f3d]">{address.label || `Endereco ${index + 1}`}</h2>
                      <p className="mt-4 text-sm leading-7 text-[#6b665f]">
                        {address.street}, {address.number}
                        <br />
                        {address.neighborhood}
                        <br />
                        {address.city} - {address.state}
                        <br />
                        CEP {address.cep}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {address.isDefault ? <Badge tone="success">Padrao</Badge> : null}
                      {!address.isDefault && address.id ? (
                        <Button variant="secondary" size="sm" onClick={() => makeDefaultAddress(address.id!)}>
                          Tornar padrao
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setAddressForm({
                            addressId: address.id || '',
                            addressLabel: address.label || '',
                            cep: address.cep,
                            street: address.street,
                            number: address.number,
                            neighborhood: address.neighborhood,
                            city: address.city,
                            state: address.state,
                            isDefault: Boolean(address.isDefault),
                          })
                        }
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="surface-panel p-6">
            <h2 className="text-4xl leading-none text-[#2a0f3d]">
              {addressForm.addressId ? 'Editar endereco' : 'Adicionar outro endereco'}
            </h2>
            <form className="mt-5 grid gap-4" onSubmit={handleAddressSubmit}>
              <InputField
                label="Rotulo"
                value={addressForm.addressLabel}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, addressLabel: event.target.value }))
                }
                placeholder="Casa, trabalho, retirada..."
              />
              <InputField
                label="CEP"
                value={addressForm.cep}
                onChange={(event) => setAddressForm((current) => ({ ...current, cep: event.target.value }))}
                required
              />
              <InputField
                label="Rua"
                value={addressForm.street}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, street: event.target.value }))
                }
                required
              />
              <InputField
                label="Numero"
                value={addressForm.number}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, number: event.target.value }))
                }
                required
              />
              <InputField
                label="Bairro"
                value={addressForm.neighborhood}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, neighborhood: event.target.value }))
                }
                required
              />
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Cidade"
                  value={addressForm.city}
                  onChange={(event) =>
                    setAddressForm((current) => ({ ...current, city: event.target.value }))
                  }
                />
                <InputField
                  label="Estado"
                  value={addressForm.state}
                  onChange={(event) =>
                    setAddressForm((current) => ({ ...current, state: event.target.value }))
                  }
                />
              </div>
              <label className="surface-soft flex items-center gap-3 px-4 py-4 text-sm text-[#2a0f3d]">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(event) =>
                    setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))
                  }
                />
                Tornar este endereco o padrao
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" fullWidth disabled={addressSaving}>
                  {addressSaving
                    ? 'Salvando...'
                    : addressForm.addressId
                      ? 'Salvar endereco'
                      : 'Adicionar endereco'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setAddressForm(emptyAddressForm)}
                >
                  Limpar
                </Button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {activeTab === 'orders' ? (
        <section className="space-y-4">
          {profile.orders.length === 0 ? (
            <EmptyState
              eyebrow="Pedidos"
              title="Nenhum pedido encontrado"
              description="Assim que uma compra for concluida, o historico aparecera aqui com status e total."
            />
          ) : (
            profile.orders.map((order) => (
              <div key={order.id} className="surface-panel p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="eyebrow">Pedido {order.id.slice(0, 8)}</p>
                    <h2 className="mt-2 text-3xl text-[#2a0f3d]">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </h2>
                    <p className="mt-2 text-sm text-[#6b665f]">Total {format(order.total)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="success">{String(order.paymentStatus)}</Badge>
                    <Badge>{String(order.orderStatus)}</Badge>
                  </div>
                </div>
                <div className="mt-4">
                  <Link to={`/pedidos/${order.id}`}>
                    <Button variant="secondary">Ver detalhes</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {message ? (
        <p className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
    </div>
  )
}
