// Base das chamadas de API: configuravel por env (deploys separados de
// frontend/backend) e cai em '/api' (mesmo dominio, via proxy) por padrao.
const API_URL = import.meta.env.VITE_API_URL ?? '/api'

// O backend responde 409 com { message, field } quando algum dado da ficha de
// cadastro ja existe. Guardar o campo aqui deixa o formulario destacar o input
// certo em vez de jogar um erro generico no topo.
export class ApiError extends Error {
  readonly status: number
  readonly field?: string

  constructor(message: string, status: number, field?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.field = field
  }
}

// Wrapper central do fetch: monta a URL completa, sempre manda JSON por
// padrao, e padroniza o formato de resposta (envelope `{ data }`) e de erro
// (lanca ApiError com status e, se houver, o campo problematico) para quem
// chama nao precisar repetir esse tratamento em cada lugar.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Erro na requisicao', response.status, payload.field)
  }

  return payload.data as T
}

// Metodos HTTP prontos para o resto do app consumir, todos passando pelo
// `request` acima (exceto upload, que precisa de multipart/form-data em vez
// de JSON e por isso monta a requisicao por conta propria).
export const api = {
  get: <T>(path: string, token?: string) =>
    request<T>(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  put: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  delete: <T>(path: string, token?: string) =>
    request<T>(path, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  // Envia um arquivo via multipart/form-data (ex.: foto de produto) e
  // devolve a URL publica onde ele ficou salvo.
  upload: async (path: string, file: File, token?: string): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new ApiError(payload.message ?? 'Erro no upload', response.status, payload.field)
    }
    return payload.data.url as string
  },
}
