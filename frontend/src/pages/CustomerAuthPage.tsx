import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Login e cadastro agora acontecem na janela flutuante (AuthModal). As rotas
 * /login e /cadastro continuam existindo para nao quebrar links antigos: elas
 * abrem a janela e devolvem o visitante para a home.
 */
export function CustomerAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { isCustomer, openAuth } = useAuth()

  useEffect(() => {
    if (isCustomer) return
    openAuth({
      view: mode === 'register' ? 'register' : 'identify',
      reason:
        mode === 'register'
          ? 'Preencha sua ficha de cadastro.'
          : 'Entre ou cadastre-se para acessar sua conta.',
    })
  }, [isCustomer, mode, openAuth])

  return <Navigate to={isCustomer ? '/conta' : '/'} replace />
}

/**
 * Destino do link enviado por e-mail na recuperacao de senha. Abre a janela
 * flutuante ja na tela de nova senha, carregando o token de uso unico.
 */
export function PasswordResetPage() {
  const [searchParams] = useSearchParams()
  const { openAuth } = useAuth()
  const resetToken = searchParams.get('token') ?? ''

  useEffect(() => {
    if (!resetToken) {
      openAuth({ reason: 'O link de recuperacao esta incompleto. Entre ou peca um novo link.' })
      return
    }
    openAuth({ view: 'reset', resetToken })
  }, [openAuth, resetToken])

  return <Navigate to="/" replace />
}
