/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { RegistrationForm } from '../types/auth'

// Unico escopo de autenticacao hoje (cliente da loja). Existe como union pra
// deixar explicito que o token nao serve pra outra coisa (ex.: admin usa a
// mesma sessao, so que com a claim "role" diferente - ver decodeTokenRole).
type AuthScope = 'customer'

// Estado persistido no localStorage: token JWT (ou null quando deslogado) e
// o escopo associado a ele.
type AuthState = {
  token: string | null
  scope: AuthScope | null
}

/**
 * `identify` = janela de login (e-mail/CPF), `register` = ficha de cadastro,
 * `reset` = tela aberta pelo link de recuperacao que chega por e-mail.
 */
export type AuthModalView = 'identify' | 'register' | 'reset'

export type AuthModalRequest = {
  /** Muda a cada abertura para a janela remontar zerada. */
  id: number
  view: AuthModalView
  /** Frase curta explicando por que a janela abriu (ex.: "para finalizar a compra"). */
  reason?: string
  prefill?: Partial<RegistrationForm>
  /** true quando o cliente ja esta logado (via Google) e so falta completar a ficha. */
  completingProfile?: boolean
  /** Token de uso unico vindo do link de recuperacao de senha. */
  resetToken?: string
}

// Formato publico do contexto: o estado de auth mais as acoes que qualquer
// componente pode chamar para logar, deslogar ou abrir a janela flutuante.
type AuthContextValue = AuthState & {
  isCustomer: boolean
  /** true quando a claim "role" do token e "admin" (destrava o Admin/ex-Organizador). */
  isAdmin: boolean
  login: (token: string, scope: AuthScope) => void
  logout: () => void
  modal: AuthModalRequest | null
  /** Abre a janela flutuante. `onSuccess` roda assim que o cliente entra. */
  openAuth: (request?: Partial<AuthModalRequest> & { onSuccess?: () => void }) => void
  closeAuth: () => void
  /**
   * Chamado pela janela quando o login/cadastro conclui. Devolve true quando
   * havia uma acao pendente (ex.: retomar o checkout) para quem chamou decidir
   * se ainda faz sentido redirecionar para outro lugar (ex.: o Admin).
   */
  completeAuth: (token: string) => boolean
  /** Executa a acao agora se ja estiver logado; senao abre a janela antes. */
  requireAuth: (onSuccess: () => void, reason?: string) => void
}

const STORAGE_KEY = 'store-auth'
// Contexto em si comeca nulo - so ganha valor dentro de AuthProvider; usar
// useAuth() fora dele deve estourar erro (ver abaixo) em vez de falhar calado.
const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Le a claim "role" direto do token, sem validar assinatura (isso e trabalho
 * do backend). Serve so para decisoes de UI, como mostrar o link do Admin ou
 * redirecionar apos o login - nunca para autorizar uma acao de verdade.
 */
export function decodeTokenRole(token: string | null | undefined): string | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=')
    const json = JSON.parse(atob(base64)) as { role?: unknown }
    return typeof json.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

// Le o estado de auth salvo no localStorage na inicializacao do provider.
// Qualquer coisa que der errado (chave ausente, JSON invalido) cai de volta
// no estado deslogado em vez de propagar o erro.
function readStoredAuth(): AuthState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as AuthState) : { token: null, scope: null }
  } catch {
    return { token: null, scope: null }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readStoredAuth)
  const [modal, setModal] = useState<AuthModalRequest | null>(null)
  // Acao que ficou "pendente" enquanto o cliente nao logava (ex.: finalizar o
  // checkout). Fica fora do estado porque e so uma funcao de callback, nao
  // algo que precisa re-renderizar nada.
  const pendingAction = useRef<(() => void) | null>(null)

  // Efetiva o login: grava token+escopo no localStorage e atualiza o estado
  // em memoria, mantendo os dois sempre em sincronia.
  const login = useCallback((token: string, scope: AuthScope) => {
    const next = { token, scope }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setState(next)
  }, [])

  // Desfaz o login: limpa o localStorage e zera o estado.
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState({ token: null, scope: null })
  }, [])

  // Abre a janela flutuante de login/cadastro/reset. Guarda o callback de
  // sucesso a parte e incrementa o "id" do modal para forcar a janela a
  // remontar do zero (limpa campos de uma abertura anterior).
  const openAuth = useCallback((request?: Partial<AuthModalRequest> & { onSuccess?: () => void }) => {
    pendingAction.current = request?.onSuccess ?? null
    setModal((current) => ({
      id: (current?.id ?? 0) + 1,
      view: request?.view ?? 'identify',
      reason: request?.reason,
      prefill: request?.prefill,
      completingProfile: request?.completingProfile,
      resetToken: request?.resetToken,
    }))
  }, [])

  // Fecha a janela sem completar nenhuma acao pendente (ex.: cliente desistiu).
  const closeAuth = useCallback(() => {
    pendingAction.current = null
    setModal(null)
  }, [])

  // Chamado pela janela quando login/cadastro termina: loga de verdade,
  // fecha o modal e, se havia uma acao pendente, executa ela aqui e avisa o
  // chamador (via retorno true) que ja foi tratada.
  const completeAuth = useCallback(
    (token: string) => {
      login(token, 'customer')
      setModal(null)
      const action = pendingAction.current
      pendingAction.current = null
      if (action) {
        action()
        return true
      }
      return false
    },
    [login],
  )

  // Deriva "esta logado" e "e admin" direto do estado a cada render, em vez
  // de guardar como estado separado - evita os dois ficarem fora de sincronia.
  const isCustomer = Boolean(state.token) && state.scope === 'customer'
  const isAdmin = isCustomer && decodeTokenRole(state.token) === 'admin'

  // Porta de entrada usada pelas telas que exigem login (ex.: checkout): se
  // ja estiver logado executa na hora, senao abre a janela e guarda a acao
  // para rodar depois que o login completar.
  const requireAuth = useCallback(
    (onSuccess: () => void, reason?: string) => {
      if (isCustomer) {
        onSuccess()
        return
      }
      openAuth({ reason, onSuccess })
    },
    [isCustomer, openAuth],
  )

  // Agrupa tudo que o contexto expoe; memoizado para nao recriar o objeto
  // (e forcar re-render de todo consumidor) a cada render do provider.
  const value = useMemo(
    () => ({
      ...state,
      isCustomer,
      isAdmin,
      login,
      logout,
      modal,
      openAuth,
      closeAuth,
      completeAuth,
      requireAuth,
    }),
    [state, isCustomer, isAdmin, login, logout, modal, openAuth, closeAuth, completeAuth, requireAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook de acesso ao contexto de auth. Estoura erro cedo se for usado fora de
// AuthProvider, em vez de deixar os componentes lidarem com `null`.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
