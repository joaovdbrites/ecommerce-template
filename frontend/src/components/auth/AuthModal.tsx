import { Eye, EyeOff, X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { decodeTokenRole, useAuth } from '../../contexts/AuthContext'
import { api, ApiError } from '../../services/api'
import type {
  AuthIdentity,
  FieldConflict,
  GoogleAuthResult,
  RegistrationField,
  RegistrationForm,
} from '../../types/auth'
import { EMPTY_REGISTRATION_FORM } from '../../types/auth'
import { formatCPF, formatPhone, getPasswordStrength } from '../../utils/checkout'
import { Button } from '../Button'
import { GoogleSignInButton } from './GoogleSignInButton'
import { useGoogleClientId } from './useGoogleClientId'

type ModalStep = 'identify' | 'password' | 'register' | 'recover' | 'reset'

type FieldErrors = Partial<Record<RegistrationField | 'identifier' | 'token', string>>

const digitsOnly = (value: string) => value.replace(/\D/g, '')

export function AuthModal() {
  const { modal, closeAuth, completeAuth, login, token } = useAuth()
  const navigate = useNavigate()
  const googleClientId = useGoogleClientId()

  // Login direto (sem acao pendente, como retomar o checkout) de uma conta
  // com cargo de administrador cai direto no Admin em vez da conta normal.
  const finishAuth = useCallback(
    (nextToken: string) => {
      const hadPendingAction = completeAuth(nextToken)
      if (!hadPendingAction && decodeTokenRole(nextToken) === 'admin') {
        navigate('/admin')
      }
    },
    [completeAuth, navigate],
  )

  const [step, setStep] = useState<ModalStep>(() => {
    if (modal?.view === 'register') return 'register'
    if (modal?.view === 'reset') return 'reset'
    return 'identify'
  })
  const [identifier, setIdentifier] = useState('')
  const [identity, setIdentity] = useState<AuthIdentity | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState<RegistrationForm>(() => ({
    ...EMPTY_REGISTRATION_FORM,
    ...modal?.prefill,
  }))
  const [completingProfile, setCompletingProfile] = useState(Boolean(modal?.completingProfile))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoverSent, setRecoverSent] = useState(false)
  /** E-mail mascarado que vai receber o link, inclusive quando se entra por CPF. */
  const [recoverTarget, setRecoverTarget] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  useEffect(() => {
    document.body.classList.add('drawer-open')
    return () => document.body.classList.remove('drawer-open')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAuth()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeAuth])

  const setField = useCallback((field: RegistrationField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }, [])

  const goToRegister = useCallback((prefill: Partial<RegistrationForm>, isCompletingProfile = false) => {
    setForm((current) => ({ ...current, ...prefill }))
    setCompletingProfile(isCompletingProfile)
    setFieldErrors({})
    setError('')
    setStep('register')
  }, [])

  const goToRecover = useCallback(() => {
    setStep('recover')
    setPassword('')
    setError('')
    setNotice('')
    setRecoverSent(false)
    setFieldErrors({})
    setRecoverTarget(identity?.maskedEmail ?? '')
  }, [identity])

  function prefillFromIdentifier(value: string): Partial<RegistrationForm> {
    const trimmed = value.trim()
    if (!trimmed) return {}
    if (trimmed.includes('@')) {
      return { email: trimmed.toLowerCase(), confirmEmail: trimmed.toLowerCase() }
    }
    return { cpf: formatCPF(trimmed) }
  }

  async function handleIdentify(event: FormEvent) {
    event.preventDefault()
    const value = identifier.trim()
    setError('')
    setNotice('')
    setFieldErrors({})

    if (!value) {
      setFieldErrors({ identifier: 'Informe seu e-mail ou CPF.' })
      return
    }

    setLoading(true)
    try {
      const result = await api.post<AuthIdentity>('/auth/customer/identify', { identifier: value })
      setIdentity(result)

      if (!result.exists) {
        setNotice('Ainda nao encontramos esse cadastro. Complete a ficha abaixo para criar sua conta.')
        goToRegister(prefillFromIdentifier(value))
        return
      }

      if (!result.hasPassword && result.hasGoogle) {
        setNotice('Esta conta entra pelo Google. Use o botao "Continuar com Google" abaixo.')
        return
      }

      setStep('password')
    } catch (err) {
      applyError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    if (!password) {
      setFieldErrors({ password: 'Informe sua senha.' })
      return
    }

    setLoading(true)
    try {
      const result = await api.post<{ token: string }>('/auth/customer/login', {
        identifier: identifier.trim(),
        password,
      })
      finishAuth(result.token)
    } catch (err) {
      applyError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRecover(event: FormEvent) {
    event.preventDefault()
    const value = identifier.trim()
    setError('')
    setFieldErrors({})

    if (!value) {
      setFieldErrors({ identifier: 'Informe seu e-mail ou CPF.' })
      return
    }

    setLoading(true)
    try {
      // Quem entra por CPF nao sabe para qual e-mail o link vai: descobrimos o
      // e-mail mascarado da conta para mostrar junto da confirmacao.
      let target = recoverTarget
      if (!target) {
        try {
          const found = await api.post<AuthIdentity>('/auth/customer/identify', { identifier: value })
          target = found.exists ? (found.maskedEmail ?? '') : ''
          setRecoverTarget(target)
        } catch {
          target = ''
        }
      }

      await api.post('/auth/customer/recover', { identifier: value })
      setRecoverSent(true)
      setNotice('')
    } catch (err) {
      applyError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    if (newPassword.length < 6) {
      setFieldErrors({ password: 'A senha precisa ter no minimo 6 caracteres.' })
      return
    }
    if (newPassword !== confirmNewPassword) {
      setFieldErrors({ confirmPassword: 'As senhas nao conferem.' })
      return
    }

    setLoading(true)
    try {
      const result = await api.post<{ token: string }>('/auth/customer/reset', {
        token: modal?.resetToken ?? '',
        password: newPassword,
      })
      finishAuth(result.token)
    } catch (err) {
      applyError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleCredential(credential: string) {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const result = await api.post<GoogleAuthResult>('/auth/customer/google', { credential })

      if (!result.needsProfile) {
        finishAuth(result.token)
        return
      }

      // O Google so entrega nome, e-mail e foto. O resto fica em branco e a
      // ficha abre para o cliente completar.
      login(result.token, 'customer')
      setNotice(
        'Conta do Google conectada. Complete os dados que o Google nao fornece para finalizar seu cadastro.',
      )
      goToRegister(
        {
          name: result.profile.name,
          email: result.profile.email,
          confirmEmail: result.profile.email,
          phone: result.profile.phone ? formatPhone(result.profile.phone) : '',
          cpf: result.profile.cpf ? formatCPF(result.profile.cpf) : '',
        },
        true,
      )
    } catch (err) {
      applyError(err)
    } finally {
      setLoading(false)
    }
  }

  async function lookupCep(rawCep: string) {
    const cep = digitsOnly(rawCep)
    if (cep.length !== 8) return
    try {
      const data = await api.get<{
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
        erro?: string
      }>(`/cep/${cep}`)
      if (data.erro) return
      setForm((current) => ({
        ...current,
        street: data.logradouro || current.street,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade ? data.localidade.toUpperCase() : current.city,
        state: data.uf || current.state,
      }))
    } catch {
      // CEP indisponivel nao bloqueia o cadastro: o cliente digita na mao.
    }
  }

  /** Confere no banco se e-mail, CPF ou telefone ja pertencem a outra conta. */
  const checkAvailability = useCallback(
    async (fields: Partial<Pick<RegistrationForm, 'email' | 'cpf' | 'phone'>>) => {
      try {
        const result = await api.post<{ conflicts: FieldConflict[] }>(
          '/auth/customer/availability',
          { email: fields.email ?? '', cpf: fields.cpf ?? '', phone: fields.phone ?? '' },
          token ?? undefined,
        )
        return result.conflicts ?? []
      } catch {
        return []
      }
    },
    [token],
  )

  async function handleFieldBlur(field: 'email' | 'cpf' | 'phone') {
    const value = form[field]
    if (!value.trim()) return
    const conflicts = await checkAvailability({ [field]: value })
    if (conflicts.length > 0) {
      setFieldErrors((current) => ({ ...current, [field]: conflicts[0].message }))
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)

    try {
      // Antes de gravar, aponta de uma vez todos os campos que ja existem.
      const conflicts = await checkAvailability({
        email: form.email,
        cpf: form.cpf,
        phone: form.phone,
      })
      if (conflicts.length > 0) {
        const mapped: FieldErrors = {}
        conflicts.forEach((conflict) => {
          mapped[conflict.field] = conflict.message
        })
        setFieldErrors(mapped)
        setError(
          conflicts.length === 1
            ? 'Um dado ja esta cadastrado. Confira o campo destacado.'
            : 'Alguns dados ja estao cadastrados. Confira os campos destacados.',
        )
        return
      }

      const result = await api.post<{ token: string }>(
        '/auth/customer/register',
        form,
        completingProfile ? (token ?? undefined) : undefined,
      )
      finishAuth(result.token)
    } catch (err) {
      applyError(err)
    } finally {
      setLoading(false)
    }
  }

  function applyError(err: unknown) {
    if (err instanceof ApiError && err.field) {
      setFieldErrors((current) => ({ ...current, [err.field as RegistrationField]: err.message }))
      setError(err.message)
      return
    }
    setError(err instanceof Error ? err.message : 'Nao foi possivel concluir. Tente novamente.')
  }

  const title =
    step === 'register'
      ? 'Ficha de cadastro'
      : step === 'recover'
        ? 'Recuperar senha'
        : step === 'reset'
          ? 'Criar uma senha nova'
          : 'Acesse sua conta ou cadastre-se'

  // A ficha e o unico passo que precisa de duas colunas; os demais ficam
  // estreitos para nao parecer um formulario gigante.
  const isWide = step === 'register'
  // Entrar com Google nao ajuda em nada nas telas de senha por e-mail. E sem
  // credencial configurada a secao some inteira (divisor incluido), em vez de
  // oferecer ao cliente um botao que nao leva a lugar nenhum.
  const stepHidesGoogle = step === 'recover' || step === 'reset' || (step === 'register' && completingProfile)
  const showGoogle = !stepHidesGoogle && Boolean(googleClientId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={closeAuth}
        className="fixed inset-0 cursor-default bg-[#2a0f3d]/50 backdrop-blur-sm"
      />

      {/* max-h-full + rolagem so no corpo: a janela nunca passa da altura da
          tela e o cabecalho fica sempre visivel. */}
      <div
        className={`relative flex max-h-full w-full flex-col ${isWide ? 'max-w-2xl' : 'max-w-xl'} overflow-hidden border border-stone-200 bg-white shadow-[var(--shadow-window)]`}
        style={{ borderRadius: 'var(--radius-window)' }}
      >
        <div className="relative shrink-0 border-b border-stone-200 px-6 py-5 sm:px-7">
          <h2 className="pr-9 text-lg font-semibold text-[#2a0f3d] sm:text-xl">{title}</h2>
          {/* O motivo da abertura ("para finalizar a compra") so faz sentido nas
              telas de entrada; nas de senha ele atrapalha mais do que ajuda. */}
          {modal?.reason && step !== 'recover' && step !== 'reset' ? (
            <p className="mt-1 text-sm leading-6 text-[#6b665f]">{modal.reason}</p>
          ) : null}
          <button
            type="button"
            aria-label="Fechar"
            onClick={closeAuth}
            className="absolute right-4 top-4 rounded-full p-2 text-[#6b665f] transition hover:bg-stone-100 hover:text-[#2a0f3d]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7">
          {notice ? (
            <p className="mb-4 rounded-[16px] border border-[#e3cfee] bg-[#f3e9f7] px-4 py-3 text-sm leading-6 text-[#6b665f]">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="mb-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {error}
            </p>
          ) : null}

          {step === 'identify' ? (
            <IdentifyStep
              identifier={identifier}
              error={fieldErrors.identifier}
              loading={loading}
              onChange={(value) => {
                setIdentifier(value)
                setFieldErrors((current) => ({ ...current, identifier: undefined }))
              }}
              onSubmit={handleIdentify}
              onRegister={() => {
                setNotice('')
                goToRegister(prefillFromIdentifier(identifier))
              }}
              onForgot={goToRecover}
            />
          ) : null}

          {step === 'password' ? (
            <PasswordStep
              password={password}
              error={fieldErrors.password}
              loading={loading}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword((value) => !value)}
              onChange={(value) => {
                setPassword(value)
                setFieldErrors((current) => ({ ...current, password: undefined }))
              }}
              onSubmit={handlePasswordLogin}
              onBack={() => {
                setStep('identify')
                setPassword('')
                setError('')
              }}
              onForgot={goToRecover}
            />
          ) : null}

          {step === 'register' ? (
            <RegisterStep
              form={form}
              fieldErrors={fieldErrors}
              loading={loading}
              completingProfile={completingProfile}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword((value) => !value)}
              onField={setField}
              onCepBlur={lookupCep}
              onUniqueBlur={handleFieldBlur}
              onSubmit={handleRegister}
              onBackToLogin={() => {
                setStep('identify')
                setNotice('')
                setError('')
              }}
            />
          ) : null}

          {step === 'recover' ? (
            <RecoverStep
              identifier={identifier}
              maskedEmail={recoverTarget}
              sent={recoverSent}
              error={fieldErrors.identifier}
              loading={loading}
              onChange={(value) => {
                setIdentifier(value)
                setRecoverTarget('')
                setFieldErrors((current) => ({ ...current, identifier: undefined }))
              }}
              onSubmit={handleRecover}
              onBack={() => {
                setStep('identify')
                setRecoverSent(false)
                setError('')
              }}
            />
          ) : null}

          {step === 'reset' ? (
            <ResetStep
              password={newPassword}
              confirmPassword={confirmNewPassword}
              fieldErrors={fieldErrors}
              loading={loading}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword((value) => !value)}
              onPassword={(value) => {
                setNewPassword(value)
                setFieldErrors((current) => ({ ...current, password: undefined }))
              }}
              onConfirmPassword={(value) => {
                setConfirmNewPassword(value)
                setFieldErrors((current) => ({ ...current, confirmPassword: undefined }))
              }}
              onSubmit={handleReset}
              onBack={() => {
                setStep('identify')
                setError('')
                setFieldErrors({})
              }}
            />
          ) : null}

          {showGoogle ? (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-stone-200" />
                <span className="whitespace-nowrap text-xs text-[#6b665f]">ou acessar com redes sociais</span>
                <span className="h-px flex-1 bg-stone-200" />
              </div>
              <div className="mt-4">
                <GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Campo largo com o botao de acao colado a direita, como na tela de login. */
function InlineField({
  label,
  value,
  placeholder,
  error,
  loading,
  action,
  type = 'text',
  trailing,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  error?: string
  loading: boolean
  action: string
  type?: string
  trailing?: ReactNode
  onChange: (value: string) => void
}) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        <label className="flex-1">
          <span className="sr-only">{label}</span>
          <div className="relative">
            <input
              autoFocus
              type={type}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              aria-invalid={Boolean(error)}
              className={`field-base ${trailing ? 'pr-11' : ''} ${error ? 'border-rose-400' : ''}`}
            />
            {trailing}
          </div>
        </label>
        <Button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-[var(--radius-button)] px-8 py-3.5 text-sm uppercase tracking-[0.18em] sm:w-auto"
        >
          {loading ? '...' : action}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
    </>
  )
}

function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-[#b77717] underline underline-offset-4 transition hover:text-[#2a0f3d]"
    >
      {children}
    </button>
  )
}

function IdentifyStep({
  identifier,
  error,
  loading,
  onChange,
  onSubmit,
  onRegister,
  onForgot,
}: {
  identifier: string
  error?: string
  loading: boolean
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onRegister: () => void
  onForgot: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <InlineField
        label="E-mail ou CPF"
        value={identifier}
        placeholder="E-mail ou CPF"
        error={error}
        loading={loading}
        action="Entrar"
        onChange={onChange}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <TextLink onClick={onRegister}>Cadastrar</TextLink>
        <TextLink onClick={onForgot}>Esqueci minha senha</TextLink>
      </div>
    </form>
  )
}

function PasswordStep({
  password,
  error,
  loading,
  showPassword,
  onToggleVisibility,
  onChange,
  onSubmit,
  onBack,
  onForgot,
}: {
  password: string
  error?: string
  loading: boolean
  showPassword: boolean
  onToggleVisibility: () => void
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onBack: () => void
  onForgot: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <InlineField
        label="Senha"
        type={showPassword ? 'text' : 'password'}
        value={password}
        placeholder="Sua senha"
        error={error}
        loading={loading}
        action="Entrar"
        onChange={onChange}
        trailing={
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
            onClick={onToggleVisibility}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#6b665f]"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <TextLink onClick={onForgot}>Esqueci minha senha</TextLink>
        <TextLink onClick={onBack}>Usar outro e-mail ou CPF</TextLink>
      </div>
    </form>
  )
}

function RecoverStep({
  identifier,
  maskedEmail,
  sent,
  error,
  loading,
  onChange,
  onSubmit,
  onBack,
}: {
  identifier: string
  maskedEmail: string
  sent: boolean
  error?: string
  loading: boolean
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onBack: () => void
}) {
  if (sent) {
    return (
      <div className="space-y-4">
        <p className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          {maskedEmail ? (
            <>
              Enviamos um link para <strong>{maskedEmail}</strong>. Ele vale por 1 hora e so pode ser usado
              uma vez.
            </>
          ) : (
            <>
              Se existir uma conta com esse e-mail ou CPF, enviamos um link para criar uma senha nova. Ele
              vale por 1 hora e so pode ser usado uma vez.
            </>
          )}
        </p>
        <p className="text-sm leading-6 text-[#6b665f]">
          Nao chegou? Confira a caixa de spam ou tente de novo em alguns minutos.
        </p>
        <Button type="button" size="lg" fullWidth onClick={onBack}>
          Voltar para o login
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="mb-3 text-sm leading-6 text-[#6b665f]">
        Informe o e-mail ou o CPF do seu cadastro. O link para criar uma senha nova vai para o e-mail da
        conta.
      </p>

      <InlineField
        label="E-mail ou CPF"
        value={identifier}
        placeholder="E-mail ou CPF"
        error={error}
        loading={loading}
        action="Enviar"
        onChange={onChange}
      />

      {maskedEmail ? (
        <p className="mt-2 text-sm text-[#6b665f]">
          O link vai para <strong className="text-[#2a0f3d]">{maskedEmail}</strong>.
        </p>
      ) : null}

      <div className="mt-3">
        <TextLink onClick={onBack}>Voltar para o login</TextLink>
      </div>
    </form>
  )
}

function ResetStep({
  password,
  confirmPassword,
  fieldErrors,
  loading,
  showPassword,
  onToggleVisibility,
  onPassword,
  onConfirmPassword,
  onSubmit,
  onBack,
}: {
  password: string
  confirmPassword: string
  fieldErrors: FieldErrors
  loading: boolean
  showPassword: boolean
  onToggleVisibility: () => void
  onPassword: (value: string) => void
  onConfirmPassword: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onBack: () => void
}) {
  const strength = getPasswordStrength(password)
  const matches = password === confirmPassword

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm leading-6 text-[#6b665f]">
        Escolha uma senha nova. Assim que confirmar, voce ja entra na sua conta.
      </p>

      {fieldErrors.token ? (
        <p className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {fieldErrors.token}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <ModalField
            label="Nova senha"
            type={showPassword ? 'text' : 'password'}
            value={password}
            error={fieldErrors.password}
            onChange={onPassword}
            trailing={
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                onClick={onToggleVisibility}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#6b665f]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          {password && !fieldErrors.password ? (
            <p className={`mt-1 text-xs font-medium ${strength.color}`}>Forca: {strength.label}</p>
          ) : null}
        </div>
        <div>
          <ModalField
            label="Confirmar nova senha"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={onConfirmPassword}
          />
          {confirmPassword && !fieldErrors.confirmPassword ? (
            <p className={`mt-1 text-xs font-medium ${matches ? 'text-emerald-600' : 'text-rose-500'}`}>
              {matches ? 'Senhas conferem' : 'Senhas nao conferem'}
            </p>
          ) : null}
        </div>
      </div>

      <Button type="submit" size="lg" fullWidth disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar senha e entrar'}
      </Button>

      <TextLink onClick={onBack}>Voltar para o login</TextLink>
    </form>
  )
}

function RegisterStep({
  form,
  fieldErrors,
  loading,
  completingProfile,
  showPassword,
  onToggleVisibility,
  onField,
  onCepBlur,
  onUniqueBlur,
  onSubmit,
  onBackToLogin,
}: {
  form: RegistrationForm
  fieldErrors: FieldErrors
  loading: boolean
  completingProfile: boolean
  showPassword: boolean
  onToggleVisibility: () => void
  onField: (field: RegistrationField, value: string) => void
  onCepBlur: (cep: string) => void
  onUniqueBlur: (field: 'email' | 'cpf' | 'phone') => void
  onSubmit: (event: FormEvent) => void
  onBackToLogin: () => void
}) {
  const strength = useMemo(() => getPasswordStrength(form.password), [form.password])
  const passwordsMatch = form.password === form.confirmPassword

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {completingProfile ? (
        <p className="text-sm leading-6 text-[#6b665f]">
          Os campos que o Google nao fornece ficaram em branco. Complete para finalizar seu cadastro.
        </p>
      ) : null}

      {/* Grade de 12 colunas: cada campo ocupa a largura que o conteudo pede,
          entao a ficha inteira cabe em 6 linhas em vez de 13. */}
      <div className="grid grid-cols-12 gap-x-3 gap-y-2.5">
        <ModalField
          className="col-span-12 sm:col-span-7"
          label="Nome completo"
          value={form.name}
          error={fieldErrors.name}
          onChange={(value) => onField('name', value)}
          autoComplete="name"
        />
        <ModalField
          className="col-span-12 sm:col-span-5"
          label="CPF"
          value={form.cpf}
          error={fieldErrors.cpf}
          onChange={(value) => onField('cpf', formatCPF(value))}
          onBlur={() => onUniqueBlur('cpf')}
          placeholder="000.000.000-00"
          inputMode="numeric"
        />
        <ModalField
          className="col-span-12 sm:col-span-7"
          label="E-mail"
          type="email"
          value={form.email}
          error={fieldErrors.email}
          readOnly={completingProfile}
          hint={completingProfile ? 'Definido pela sua conta Google' : undefined}
          onChange={(value) => onField('email', value)}
          onBlur={() => onUniqueBlur('email')}
          autoComplete="email"
        />
        <ModalField
          className="col-span-12 sm:col-span-5"
          label="Telefone"
          value={form.phone}
          error={fieldErrors.phone}
          onChange={(value) => onField('phone', formatPhone(value))}
          onBlur={() => onUniqueBlur('phone')}
          placeholder="(00) 00000-0000"
          inputMode="tel"
        />
        <ModalField
          className="col-span-12 sm:col-span-7"
          label="Confirmar e-mail"
          type="email"
          value={form.confirmEmail}
          error={fieldErrors.confirmEmail}
          readOnly={completingProfile}
          onChange={(value) => onField('confirmEmail', value)}
        />
        <ModalField
          className="col-span-12 sm:col-span-5"
          label="CEP"
          value={form.cep}
          error={fieldErrors.cep}
          onChange={(value) => {
            onField('cep', value)
            if (digitsOnly(value).length === 8) onCepBlur(value)
          }}
          onBlur={() => onCepBlur(form.cep)}
          placeholder="00000-000"
          inputMode="numeric"
        />
        <ModalField
          className="col-span-8 sm:col-span-9"
          label="Rua"
          value={form.street}
          error={fieldErrors.street}
          onChange={(value) => onField('street', value)}
          autoComplete="address-line1"
        />
        <ModalField
          className="col-span-4 sm:col-span-3"
          label="Numero"
          value={form.number}
          error={fieldErrors.number}
          onChange={(value) => onField('number', value)}
        />
        <ModalField
          className="col-span-12 sm:col-span-5"
          label="Bairro"
          value={form.neighborhood}
          error={fieldErrors.neighborhood}
          onChange={(value) => onField('neighborhood', value)}
        />
        <ModalField
          className="col-span-8 sm:col-span-4"
          label="Cidade"
          value={form.city}
          error={fieldErrors.city}
          onChange={(value) =>
            onField('city', value.toLowerCase() === 'campo grande' ? 'CAMPO GRANDE' : value)
          }
        />
        <ModalField
          className="col-span-4 sm:col-span-3"
          label="UF"
          value={form.state}
          error={fieldErrors.state}
          onChange={(value) => onField('state', value.toUpperCase().slice(0, 2))}
        />

        <div className="col-span-12 sm:col-span-6">
          <ModalField
            label={completingProfile ? 'Senha (opcional)' : 'Senha para cadastro'}
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            error={fieldErrors.password}
            hint={completingProfile ? 'Defina para entrar sem o Google' : undefined}
            onChange={(value) => onField('password', value)}
            trailing={
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                onClick={onToggleVisibility}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#6b665f]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          {form.password && !fieldErrors.password ? (
            <p className={`mt-1 text-xs font-medium ${strength.color}`}>Forca: {strength.label}</p>
          ) : null}
        </div>
        <div className="col-span-12 sm:col-span-6">
          <ModalField
            label="Confirmar senha"
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={(value) => onField('confirmPassword', value)}
          />
          {form.confirmPassword && !fieldErrors.confirmPassword ? (
            <p
              className={`mt-1 text-xs font-medium ${passwordsMatch ? 'text-emerald-600' : 'text-rose-500'}`}
            >
              {passwordsMatch ? 'Senhas conferem' : 'Senhas nao conferem'}
            </p>
          ) : null}
        </div>
      </div>

      <Button type="submit" size="lg" fullWidth disabled={loading}>
        {loading ? 'Enviando...' : completingProfile ? 'Concluir cadastro' : 'Criar conta e entrar'}
      </Button>

      {completingProfile ? null : <TextLink onClick={onBackToLogin}>Ja tenho cadastro</TextLink>}
    </form>
  )
}

function ModalField({
  label,
  value,
  error,
  hint,
  className = '',
  onChange,
  onBlur,
  trailing,
  type = 'text',
  ...props
}: {
  label: string
  value: string
  error?: string
  hint?: string
  className?: string
  onChange: (value: string) => void
  onBlur?: () => void
  trailing?: ReactNode
  type?: string
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'tel'
  autoComplete?: string
  readOnly?: boolean
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b665f]">
        {label}
      </span>
      <div className="relative">
        <input
          {...props}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          className={`field-base field-compact ${trailing ? 'pr-10' : ''} ${
            error ? 'border-rose-400' : ''
          } ${props.readOnly ? 'bg-stone-100 text-[#6b665f]' : ''}`}
        />
        {trailing}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-xs text-[#8b847b]">{hint}</p> : null}
    </label>
  )
}
