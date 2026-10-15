const STORAGE_KEY = 'op_session_id'

/**
 * Identificador anonimo e estavel por navegador, usado para atribuir
 * visualizacoes/cliques a um visitante mesmo sem login (ex.: "Mais
 * procurados"). Nao tem relacao com autenticacao.
 */
export function getSessionId(): string {
  try {
    // Reusa o id ja salvo, se existir; senao gera um novo e persiste para as
    // proximas visitas.
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const generated = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, generated)
    return generated
  } catch {
    // localStorage bloqueado (modo privado, etc.) - devolve vazio em vez de
    // quebrar o analytics de visualizacao/clique.
    return ''
  }
}
