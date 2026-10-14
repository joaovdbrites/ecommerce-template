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

export type FieldConflict = {
  field: RegistrationField
  message: string
}

export type GoogleProfile = {
  name: string
  email: string
  phone: string
  cpf: string
  avatarUrl: string
}

export type GoogleAuthResult = {
  token: string
  /** true quando o Google nao entregou tudo e a ficha precisa ser completada. */
  needsProfile: boolean
  profile: GoogleProfile
}

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
