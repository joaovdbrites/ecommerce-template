import { useEffect, useState } from 'react'
import { api } from '../services/api'

// Sem numero configurado em Configuracoes > Geral, o botao de atendimento
// fica sem destino valido (string vazia) em vez de usar um numero de outra loja.
const FALLBACK_WHATSAPP = ''

// Promise compartilhada entre instancias do hook, igual useStoreTheme -
// garante uma unica busca mesmo com varios componentes usando useStoreWhatsapp.
let whatsappPromise: Promise<string> | null = null

// Busca o numero de WhatsApp configurado; qualquer falha (rede, config
// ausente) cai no fallback vazio em vez de propagar o erro.
function fetchStoreWhatsapp(): Promise<string> {
  if (!whatsappPromise) {
    whatsappPromise = api
      .get<{ storeWhatsapp?: string }>('/store/config')
      .then((config) => config.storeWhatsapp || FALLBACK_WHATSAPP)
      .catch(() => FALLBACK_WHATSAPP)
  }
  return whatsappPromise
}

/** Numero de WhatsApp da loja configurado no admin, para os links de atendimento. */
export function useStoreWhatsapp(): string {
  const [whatsapp, setWhatsapp] = useState(FALLBACK_WHATSAPP)

  useEffect(() => {
    let cancelled = false
    fetchStoreWhatsapp().then((value) => {
      if (!cancelled) setWhatsapp(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return whatsapp
}
