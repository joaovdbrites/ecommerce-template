import { useEffect, useState } from 'react'
import { api } from '../services/api'

// Sem numero configurado em Configuracoes > Geral, o botao de atendimento
// fica sem destino valido (string vazia) em vez de usar um numero de outra loja.
const FALLBACK_WHATSAPP = ''

let whatsappPromise: Promise<string> | null = null

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
