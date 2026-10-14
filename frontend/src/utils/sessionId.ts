const STORAGE_KEY = 'op_session_id'

/**
 * Identificador anonimo e estavel por navegador, usado para atribuir
 * visualizacoes/cliques a um visitante mesmo sem login (ex.: "Mais
 * procurados"). Nao tem relacao com autenticacao.
 */
export function getSessionId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const generated = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, generated)
    return generated
  } catch {
    return ''
  }
}
