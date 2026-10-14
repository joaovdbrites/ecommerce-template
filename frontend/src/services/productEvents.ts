import { getSessionId } from '../utils/sessionId'
import { api } from './api'

type ProductEventType = 'view' | 'click'

/**
 * Registra uma visualizacao/clique de produto para alimentar os carrosseis
 * automaticos da home (Mais procurados, Visto recentemente, Recomendado).
 * Dispara sem bloquear a navegacao e ignora falhas silenciosamente - e um
 * sinal de analytics, nunca deve impedir o uso do site.
 */
export function trackProductEvent(productId: string, type: ProductEventType, token?: string | null) {
  if (!productId) return
  api
    .post('/store/events', { productId, type, sessionId: getSessionId() }, token ?? undefined)
    .catch(() => {})
}
