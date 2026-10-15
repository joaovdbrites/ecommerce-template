/** Campos da ficha de cadastro. Os mesmos nomes voltam no erro 409 do backend. */
export type RegistrationField =
  | 'name'
  | 'email'
  | 'confirmEmail'
  | 'phone'
  | 'cpf'
  | 'password'
  | 'confirmPassword'
  | 'cep'
  | 'street'
  | 'number'
  | 'neighborhood'
  | 'city'
  | 'state'

export type RegistrationForm = Record<RegistrationField, string>

/** Resposta da etapa 1 do login: o e-mail/CPF digitado tem cadastro? */
export type AuthIdentity = {
  exists: boolean
  identifierType: 'email' | 'cpf'
  hasPassword: boolean
  hasGoogle: boolean
  firstName?: string
  maskedEmail?: string
}

// Erro 409 do backend ao tentar cadastrar: diz qual campo da ficha ja existe
// e a mensagem pronta para mostrar perto dele.
export type FieldConflict = {
  field: RegistrationField
  message: string
}

// Dados do cliente devolvidos pelo login/cadastro via Google - podem vir
// incompletos (ver needsProfile em GoogleAuthResult).
export type GoogleProfile = {
  name: string
  email: string
  phone: string
  cpf: string
  avatarUrl: string
}

// Resultado de um login/cadastro feito via Google.
export type GoogleAuthResult = {
  token: string
  /** true quando o Google nao entregou tudo e a ficha precisa ser completada. */
  needsProfile: boolean
  profile: GoogleProfile
}

// Estado inicial (todos os campos vazios) para a ficha de cadastro.
export const EMPTY_REGISTRATION_FORM: RegistrationForm = {
  name: '',
  email: '',
  confirmEmail: '',
  phone: '',
  cpf: '',
  password: '',
  confirmPassword: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
}
