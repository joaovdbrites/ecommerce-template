import { useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import { api } from '../services/api'
import {
  createOrganizerId,
  initialOrganizerStore,
  itensRootNode,
  type OrganizerActivity,
  type OrganizerContentType,
  type OrganizerNode,
  type OrganizerStatus,
  type OrganizerStore,
  type OrganizerTag,
  type OrganizerTrashEntry,
  type OrganizerVariant,
} from '../types/organizer'

// Chave do localStorage onde a copia local da estrutura do Organizador fica
// guardada, nome do evento customizado usado para avisar outras instancias
// do hook (na mesma aba) de uma mudanca, e quantas atividades recentes ficam
// "visiveis" antes de contar como duplicata (ver dedupeStoredActivities).
const STORAGE_KEY = 'store-organizer-v1'
const SYNC_EVENT = 'store-organizer-sync'
const VISIBLE_RECENT_LIMIT = 7
// A pagina do admin monta varias instancias independentes deste hook ao
// mesmo tempo (preview do site reaproveita Home/Header/etc, cada um com seu
// proprio polling). Esse timestamp e por modulo (nao por instancia) para que
// uma edicao feita em QUALQUER instancia faca TODAS as outras pausarem a
// aplicacao de respostas remotas por um tempo - senao o polling de uma
// instancia so-leitura pode aplicar um GET desatualizado e, via
// SYNC_EVENT/localStorage, sobrescrever a edicao que acabou de ser salva.
let lastLocalEditAt = 0
const REMOTE_APPLY_COOLDOWN_MS = 4_000
function withinEditCooldown() {
  return Date.now() - lastLocalEditAt < REMOTE_APPLY_COOLDOWN_MS
}

// Comparacao "profunda" barata via serializacao - a store inteira e pequena
// o bastante pra isso ser mais simples (e confiavel) que um deep-equal manual.
function storesAreEqual(left: OrganizerStore, right: OrganizerStore) {
  return JSON.stringify(left) === JSON.stringify(right)
}

// Remove atividades repetidas (mesmo label+detail) enquanto ainda estiverem
// dentro da janela "visivel" do feed, e limita o historico total a 50
// entradas - evita, por ex., que salvar o mesmo campo varias vezes em
// sequencia polua o feed de atividades com linhas identicas.
function dedupeStoredActivities(entries: OrganizerActivity[]) {
  const result: OrganizerActivity[] = []
  entries.forEach((entry) => {
    const repeatedWhileVisible = result
      .slice(0, VISIBLE_RECENT_LIMIT)
      .some((visibleEntry) => visibleEntry.label === entry.label && visibleEntry.detail === entry.detail)
    if (!repeatedWhileVisible) result.push(entry)
  })
  return result.slice(0, 50)
}

// Le e normaliza a store do Organizador a partir do localStorage. Alem de
// desserializar, reconcilia a estrutura salva com os nos padrao (initialOrganizerStore)
// pra lojas antigas ganharem automaticamente nos/campos novos sem perder o
// que o lojista ja customizou. Qualquer falha (JSON invalido, etc.) cai de
// volta na store inicial em vez de quebrar o site.
function loadOrganizerStore(): OrganizerStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialOrganizerStore

    const parsed = JSON.parse(saved) as Partial<OrganizerStore>
    const savedNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
    // Se nem o no "home" existe, a estrutura salva e de antes do Organizador
    // existir (ou esta corrompida) - nesse caso, parte dos nos padrao e so
    // aplica por cima qualquer dado salvo que corresponda por id, preservando
    // campos estruturais (rota, variante, builtin, immutable) do padrao.
    const hasOrganizerStructure = savedNodes.some((node) => node.id === 'home')
    const sourceNodes = hasOrganizerStructure
      ? savedNodes
      : [
          ...initialOrganizerStore.nodes.map((defaultNode) => ({
            ...defaultNode,
            ...savedNodes.find((node) => node.id === defaultNode.id),
            route: defaultNode.route,
            variant: defaultNode.variant,
            builtin: defaultNode.builtin,
            immutable: defaultNode.immutable,
          })),
          ...savedNodes.filter(
            (node) => !initialOrganizerStore.nodes.some((defaultNode) => defaultNode.id === node.id),
          ),
        ]

    // Preenche campos ausentes de cada no salvo (migracoes incrementais) com
    // os defaults correspondentes (quando o no e um dos builtin) ou com um
    // valor neutro, garantindo que o objeto final sempre bata com o tipo
    // OrganizerNode mesmo que o JSON salvo seja de uma versao mais antiga.
    const normalizedNodes = sourceNodes.map((node) => {
      const defaults = initialOrganizerStore.nodes.find((candidate) => candidate.id === node.id)
      const variant =
        defaults?.variant === 'product-grid'
          ? 'product-grid'
          : (node.variant ?? defaults?.variant ?? 'standard')
      return {
        ...defaults,
        ...node,
        description: node.description ?? defaults?.description ?? '',
        status: node.status ?? defaults?.status ?? 'draft',
        imageUrl: node.imageUrl ?? '',
        price: Number(node.price) || 0,
        size: node.size ?? defaults?.size ?? 'medium',
        tagIds: Array.isArray(node.tagIds) ? node.tagIds : [],
        itemIds: Array.isArray(node.itemIds) ? node.itemIds : [],
        createdAt: node.createdAt ?? new Date().toISOString(),
        updatedAt: node.updatedAt ?? new Date().toISOString(),
        builtin: defaults?.builtin ?? node.builtin,
        immutable: defaults ? Boolean(defaults.immutable) : Boolean(node.immutable),
        variant,
        type: variant === 'product-grid' ? 'catalog' : (node.type ?? defaults?.type ?? 'item'),
      } as OrganizerNode
    })

    // Correcao de dados antigos: paginas duplicadas com rota "/" (alem da
    // "home" oficial) sao descartadas, e qualquer no que apontava pra elas
    // como pai e realocado para "home" em vez de ficar orfao.
    const duplicateRootIds = new Set(
      normalizedNodes
        .filter((node) => node.type === 'page' && node.route === '/' && node.id !== 'home')
        .map((node) => node.id),
    )
    const nodes = normalizedNodes
      .filter((node) => !duplicateRootIds.has(node.id))
      .map((node) =>
        node.parentId && duplicateRootIds.has(node.parentId) ? { ...node, parentId: 'home' } : node,
      )

    return {
      nodes,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      activities: Array.isArray(parsed.activities)
        ? dedupeStoredActivities(parsed.activities).map((entry) =>
            entry.targetId && duplicateRootIds.has(entry.targetId) ? { ...entry, targetId: 'home' } : entry,
          )
        : [],
      trash: Array.isArray(parsed.trash) ? parsed.trash : [],
    }
  } catch {
    return initialOrganizerStore
  }
}

// Monta uma entrada de atividade pronta pra entrar no feed "Atividade
// recente" do Organizador, com id e timestamp gerados na hora.
function activity(label: string, detail: string, targetId: string | null): OrganizerActivity {
  return {
    id: createOrganizerId('activity'),
    label,
    detail,
    targetId,
    createdAt: new Date().toISOString(),
  }
}

// Adiciona uma atividade nova no topo do feed da store, substituindo uma
// entrada igual (mesmo label+detail) se ela ainda estiver na janela visivel -
// evita que a mesma acao repetida em sequencia rapida vire varias linhas.
function withActivity(store: OrganizerStore, nextActivity: OrganizerActivity): OrganizerStore {
  const visibleDuplicate = store.activities
    .slice(0, VISIBLE_RECENT_LIMIT)
    .find((entry) => entry.label === nextActivity.label && entry.detail === nextActivity.detail)
  const activities = visibleDuplicate
    ? store.activities.filter((entry) => entry.id !== visibleDuplicate.id)
    : store.activities

  return { ...store, activities: [nextActivity, ...activities].slice(0, 50) }
}

// Campos aceitos para criar um no novo no Organizador (pagina, pasta,
// carrossel, catalogo, destaque ou item) - um subconjunto de OrganizerNode,
// ja que varios campos (id, timestamps, rota final) sao calculados por createNode.
export type CreateOrganizerNodeInput = {
  name: string
  type: OrganizerContentType
  parentId: string | null
  description?: string
  imageUrl?: string
  images?: string[]
  price?: number
  size?: OrganizerNode['size']
  tagIds?: string[]
  itemIds?: string[]
  variant?: OrganizerVariant
  route?: string
  status?: OrganizerStatus
  sku?: string
  brand?: string
  volumeMl?: number
  stock?: number
  pixDiscountPercent?: number
}

// Hook central que mantem a estrutura do Organizador (paginas, pastas,
// carrosseis, catalogos, destaques e itens) sincronizada entre: o estado em
// memoria desta instancia, o localStorage (cache local e canal de sync entre
// abas), e o backend (fonte da verdade compartilhada entre dispositivos).
// E instanciado em varios lugares ao mesmo tempo (admin + preview do site),
// entao grande parte da logica aqui existe pra evitar que essas instancias
// pisem umas nas outras ou apliquem dados desatualizados por cima de edicoes
// recentes. Devolve o estado da store mais as acoes de CRUD sobre ela.
export function useOrganizerStore(token?: string) {
  const [store, setStore] = useState<OrganizerStore>(loadOrganizerStore)
  // true assim que a primeira resposta do servidor (sucesso ou falha) chega -
  // usado para destravar efeitos que nao devem rodar com dados so locais.
  const [remoteReady, setRemoteReady] = useState(false)
  // Espelha `store` para ser lido de dentro de callbacks/efeitos sem precisar
  // declarar `store` como dependencia (evitaria recriar o efeito a cada edicao).
  const storeRef = useRef(store)
  // true entre uma edicao local e o PUT correspondente ter sido confirmado -
  // enquanto isso, respostas remotas (poll ou evento de outra aba) sao ignoradas
  // pra nao sobrescrever a edicao que ainda nao foi salva no servidor.
  const pendingLocalSave = useRef(false)
  // Contador incrementado a cada edicao local; usado pelo polling para
  // detectar se uma edicao aconteceu enquanto uma requisicao GET estava em
  // voo, e nesse caso descartar a resposta (pode estar desatualizada).
  const localRevision = useRef(0)
  const hasSyncedWithServer = useRef(false)
  // Trava simples para garantir no maximo um PUT em voo por vez (ver flushPendingPut).
  const isPutInFlight = useRef(false)
  // Guarda so o snapshot mais recente ainda nao enviado - varias edicoes
  // rapidas colapsam em um unico PUT com o estado final.
  const latestSnapshotToPut = useRef<OrganizerStore | null>(null)
  const isOrganizerRoute = window.location.pathname === '/admin'
  // Salvar (PUT) agora exige o token de administrador; ler (GET) continua
  // publico porque o site inteiro depende da estrutura para renderizar.
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  // Wrapper em volta de setStore usado por toda edicao local: alem de
  // atualizar o estado, marca que ha uma edicao pendente de salvar, avanca a
  // revisao local e registra o instante da edicao (pro cooldown de
  // aplicacao remota). So mexe nesses marcadores quando o conteudo de fato mudou.
  const setLocalStore = (updater: SetStateAction<OrganizerStore>) => {
    setStore((current) => {
      const next =
        typeof updater === 'function'
          ? (updater as (value: OrganizerStore) => OrganizerStore)(current)
          : updater

      if (!storesAreEqual(current, next)) {
        pendingLocalSave.current = true
        localRevision.current += 1
        lastLocalEditAt = Date.now()
      }
      return next
    })
  }

  // Mantem storeRef sempre apontando para o store mais recente.
  useEffect(() => {
    storeRef.current = store
  }, [store])

  // Escuta os dois canais de sincronizacao entre instancias/abas: o evento
  // customizado SYNC_EVENT (mesma aba, outras instancias do hook) e o evento
  // nativo "storage" (outras abas). Em ambos os casos, uma edicao local
  // pendente ou o cooldown pos-edicao bloqueia a aplicacao do dado recebido,
  // pra nao sobrescrever algo que acabou de ser alterado aqui.
  useEffect(() => {
    const handleSync = (event: Event) => {
      const nextStore = (event as CustomEvent<OrganizerStore>).detail
      if (!nextStore || pendingLocalSave.current || withinEditCooldown()) return
      setStore((current) => (storesAreEqual(current, nextStore) ? current : nextStore))
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue || pendingLocalSave.current || withinEditCooldown()) return
      const nextStore = loadOrganizerStore()
      setStore((current) => (storesAreEqual(current, nextStore) ? current : nextStore))
    }

    window.addEventListener(SYNC_EVENT, handleSync)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Toda vez que o store muda, propaga para as outras instancias: grava no
  // localStorage (so na rota do admin, que e quem deve ser a fonte local) e
  // dispara o evento customizado pras instancias na mesma aba (ex.: preview).
  useEffect(() => {
    if (isOrganizerRoute) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    }
    window.dispatchEvent(new CustomEvent<OrganizerStore>(SYNC_EVENT, { detail: store }))
  }, [isOrganizerRoute, store])

  // Efeito principal de sincronizacao com o backend: faz uma busca inicial
  // (podendo inicializar o servidor se ele ainda nao tiver dados) e depois
  // faz polling periodico para pegar mudancas feitas em outros dispositivos.
  useEffect(() => {
    let cancelled = false

    // Aplica uma store vinda do servidor por cima do estado local, respeitando
    // o cooldown/edicao pendente (ver comentario abaixo) para nao perder uma
    // edicao que acabou de ser feita aqui.
    const applyRemoteStore = (remoteStore: OrganizerStore) => {
      // Antes da primeira sincronizacao, o estado local e so o esqueleto padrao
      // (loadOrganizerStore ainda nao confirmou os dados reais) - uma edicao feita
      // nesse instante nao pode bloquear a chegada dos dados reais do servidor,
      // senao esse esqueleto acaba sendo salvo por cima deles.
      if (hasSyncedWithServer.current && (pendingLocalSave.current || withinEditCooldown())) return
      hasSyncedWithServer.current = true

      if (isOrganizerRoute) {
        // No admin, grava no localStorage primeiro e re-le com loadOrganizerStore
        // para passar pela mesma normalizacao usada no boot (preenche campos
        // que porventura faltem no dado vindo do servidor).
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteStore))
        const normalizedStore = loadOrganizerStore()
        setStore((current) => (storesAreEqual(current, normalizedStore) ? current : normalizedStore))
        return
      }
      // Fora do admin (preview do site), aplica o dado remoto direto, sem
      // persistir local - essas instancias so leem.
      setStore((current) => (storesAreEqual(current, remoteStore) ? current : remoteStore))
    }

    // Busca o estado atual do servidor; se ele ainda nao tiver nada e
    // `allowInitialize` for true (so faz sentido no admin), envia o estado
    // local atual como ponto de partida - e assim que uma loja nova "semeia"
    // o backend na primeira visita ao admin.
    const syncFromServer = async (allowInitialize: boolean) => {
      const revisionAtStart = localRevision.current
      try {
        const remoteStore = await api.get<OrganizerStore | null>('/organizer')
        if (cancelled) return
        // Uma edicao local aconteceu enquanto o GET estava em voo - descarta
        // essa resposta, que pode nao refletir mais o estado mais recente.
        if (revisionAtStart !== localRevision.current) return

        if (remoteStore && Array.isArray(remoteStore.nodes)) {
          applyRemoteStore(remoteStore)
        } else if (allowInitialize && isOrganizerRoute) {
          await api.put<OrganizerStore>('/organizer', storeRef.current, tokenRef.current)
          hasSyncedWithServer.current = true
        }
      } catch {
        // O armazenamento local continua sendo usado quando o backend estiver indisponível.
      } finally {
        if (!cancelled) setRemoteReady(true)
      }
    }

    // Primeira sincronizacao pode inicializar o servidor; as seguintes
    // (via polling a cada 2s) so leem e aplicam, nunca inicializam de novo.
    void syncFromServer(true)
    const interval = window.setInterval(() => void syncFromServer(false), 2_000)

    return () => {
      cancelled = true
      if (interval) window.clearInterval(interval)
    }
  }, [isOrganizerRoute])

  // Auto-correcao de uma unica vez: lojas que sincronizaram antes da area
  // "Itens" existir nao tem esse no. Sem ele, criar subpasta/item fica
  // impossivel - entao criamos aqui assim que a base real do servidor chega,
  // em vez de exigir uma migracao manual.
  useEffect(() => {
    if (!isOrganizerRoute || !remoteReady) return
    setLocalStore((current) =>
      current.nodes.some((node) => node.id === 'itens')
        ? current
        : { ...current, nodes: [...current.nodes, itensRootNode] },
    )
  }, [isOrganizerRoute, remoteReady])

  useEffect(() => {
    if (!isOrganizerRoute || !remoteReady || !pendingLocalSave.current || !hasSyncedWithServer.current) return

    const timeout = window.setTimeout(() => {
      latestSnapshotToPut.current = storeRef.current
      void flushPendingPut()
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [isOrganizerRoute, remoteReady, store])

  // So um PUT pode estar em voo por vez - caso contrario, dois salvamentos
  // disparados em sequencia rapida podem terminar fora de ordem na rede, e o
  // mais antigo (com dados desatualizados) sobrescreveria o mais novo no
  // servidor mesmo chegando depois. Aqui, qualquer edicao que aconteca
  // enquanto um PUT esta em voo so atualiza "o que falta mandar", e o loop
  // sempre envia por ultimo o estado mais recente conhecido.
  async function flushPendingPut() {
    if (isPutInFlight.current) return
    isPutInFlight.current = true
    try {
      while (latestSnapshotToPut.current) {
        const snapshot = latestSnapshotToPut.current
        latestSnapshotToPut.current = null
        try {
          await api.put<OrganizerStore>('/organizer', snapshot, tokenRef.current)
          if (storesAreEqual(storeRef.current, snapshot)) pendingLocalSave.current = false
        } catch {
          // Mantem pendingLocalSave true; a proxima edicao (ou o proprio
          // usuario salvando de novo) tenta reenviar.
        }
      }
    } finally {
      isPutInFlight.current = false
    }
  }

  // Cria um no novo (pagina, pasta, carrossel, catalogo, destaque ou item) e
  // o adiciona a store local, registrando uma atividade. Devolve o id do no
  // criado, que quem chamou costuma usar para navegar ate ele.
  function createNode(input: CreateOrganizerNodeInput) {
    const timestamp = new Date().toISOString()
    // Gera um slug a partir do nome: remove acentos, poe em minusculas e
    // troca qualquer coisa que nao seja letra/numero por hifen.
    const baseSlug = input.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const requestedRoute = input.route?.trim()
    // Se o usuario digitou uma rota propria, usa o ultimo segmento dela como
    // slug preferido (mesmo tratamento de acentos/caixa do baseSlug acima).
    const requestedSlug = requestedRoute
      ?.split('/')
      .filter(Boolean)
      .at(-1)
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const baseRoute = `/pagina/${requestedSlug || baseSlug || 'nova-pagina'}`
    let pageRoute = baseRoute
    let routeSuffix = 2
    // So paginas tem rota propria - se ja existir uma pagina com essa rota,
    // vai incrementando um sufixo numerico ate achar uma rota livre.
    while (input.type === 'page' && store.nodes.some((existing) => existing.route === pageRoute)) {
      pageRoute = `${baseRoute}-${routeSuffix}`
      routeSuffix += 1
    }
    const node: OrganizerNode = {
      id: createOrganizerId(input.type),
      name: input.name.trim(),
      type: input.type,
      parentId: input.type === 'page' ? null : input.parentId,
      description: input.description?.trim() ?? '',
      status: input.status ?? (input.type === 'page' ? 'published' : 'draft'),
      imageUrl: input.imageUrl?.trim() ?? '',
      images: input.images,
      price: input.price ?? 0,
      size: input.size ?? 'medium',
      tagIds: input.tagIds ?? [],
      itemIds: input.itemIds ?? [],
      variant:
        input.variant ??
        (input.type === 'carousel'
          ? 'product-carousel'
          : input.type === 'catalog'
            ? 'product-grid'
            : input.type === 'highlight'
              ? 'banner'
              : 'standard'),
      route: input.type === 'page' ? pageRoute : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
      sku: input.sku,
      brand: input.brand,
      volumeMl: input.volumeMl,
      stock: input.stock,
      pixDiscountPercent: input.pixDiscountPercent,
    }

    setLocalStore((current) =>
      withActivity(
        { ...current, nodes: [...current.nodes, node] },
        activity(`${node.name} criado`, 'Novo conteúdo adicionado', node.id),
      ),
    )
    return node.id
  }

  // Cria uma tag nova (usada para marcar itens e, opcionalmente, aplicar um
  // desconto automatico) e devolve o id criado.
  function createTag(name: string, color: string, discountPercent?: number) {
    const timestamp = new Date().toISOString()
    const tag: OrganizerTag = {
      id: createOrganizerId('tag'),
      name: name.trim(),
      color,
      discountPercent,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    setLocalStore((current) =>
      withActivity(
        { ...current, tags: [...current.tags, tag] },
        activity(`${tag.name} criada`, 'Nova tag adicionada', tag.id),
      ),
    )
    return tag.id
  }

  // Aplica atualizacoes parciais a um no existente. `log = false` e usado
  // para mudancas que nao devem poluir o feed de atividades (ex.: ajustes
  // automaticos internos em vez de uma edicao feita pelo lojista).
  function updateNode(id: string, updates: Partial<OrganizerNode>, log = true) {
    setLocalStore((current) => {
      const existing = current.nodes.find((node) => node.id === id)
      if (!existing) return current

      const nodes = current.nodes.map((node) =>
        node.id === id ? { ...node, ...updates, id: node.id, updatedAt: new Date().toISOString() } : node,
      )
      const next = { ...current, nodes }
      return log ? withActivity(next, activity(`${existing.name} atualizado`, 'Alterações salvas', id)) : next
    })
  }

  // Aplica atualizacoes parciais a uma tag existente (nome, cor ou desconto).
  function updateTag(id: string, updates: Partial<OrganizerTag>) {
    setLocalStore((current) => {
      const existing = current.tags.find((tag) => tag.id === id)
      if (!existing) return current

      return withActivity(
        {
          ...current,
          tags: current.tags.map((tag) =>
            tag.id === id ? { ...tag, ...updates, id: tag.id, updatedAt: new Date().toISOString() } : tag,
          ),
        },
        activity(`${existing.name} atualizada`, 'Tag modificada', id),
      )
    })
  }


  // So registra no feed de atividades que um no foi aberto no Organizador -
  // nao muda nenhum dado do no em si.
  function recordAccess(id: string, label: string) {
    setLocalStore((current) => withActivity(current, activity(label, 'Aberto no organizador', id)))
  }

  // Cria uma copia de um no existente (mesmos dados, nome com sufixo
  // "- copia"). Devolve o id do novo no, ou null se o original nao existir mais.
  function duplicateNode(id: string) {
    const existing = store.nodes.find((node) => node.id === id)
    if (!existing) return null
    return createNode({
      name: `${existing.name} - cópia`,
      type: existing.type,
      parentId: existing.parentId,
      description: existing.description,
      imageUrl: existing.imageUrl,
      price: existing.price,
      size: existing.size,
      tagIds: existing.tagIds,
      itemIds: existing.itemIds,
      variant: existing.variant,
    })
  }

  // Reordena um no uma posicao para cima/baixo entre seus irmaos (mesmo
  // parentId). Nos imutaveis (builtin que nao pode mover) bloqueiam o
  // movimento, tanto o que esta sendo movido quanto o vizinho que ele trocaria de lugar.
  function moveNode(id: string, direction: 'up' | 'down') {
    setLocalStore((current) => {
      const currentNode = current.nodes.find((node) => node.id === id)
      if (!currentNode || currentNode.immutable) return current

      const siblings = current.nodes.filter((node) => node.parentId === currentNode.parentId)
      const siblingIndex = siblings.findIndex((node) => node.id === id)
      const targetSibling = siblings[siblingIndex + (direction === 'up' ? -1 : 1)]
      if (!targetSibling || targetSibling.immutable) return current

      // Troca as posicoes dos dois nos na lista completa (nao so entre os
      // irmaos), preservando a ordem relativa de todo o resto.
      const sourceIndex = current.nodes.findIndex((node) => node.id === currentNode.id)
      const targetIndex = current.nodes.findIndex((node) => node.id === targetSibling.id)
      const nodes = [...current.nodes]
      ;[nodes[sourceIndex], nodes[targetIndex]] = [nodes[targetIndex], nodes[sourceIndex]]

      return withActivity(
        { ...current, nodes },
        activity(
          `${currentNode.name} reorganizado`,
          direction === 'up' ? 'Movido para cima' : 'Movido para baixo',
          id,
        ),
      )
    })
  }

  // Move um no e toda a sua descendencia (subpastas, itens dentro delas etc.)
  // para a lixeira, de onde pode ser restaurado depois.
  function moveNodeToTrash(id: string) {
    setLocalStore((current) => {
      // Acha todos os descendentes do no alvo em um loop de ponto fixo:
      // a cada rodada, adiciona qualquer no cujo pai ja esteja no conjunto,
      // repetindo ate uma rodada nao encontrar mais nenhum novo (cobre
      // qualquer profundidade de aninhamento, nao so um nivel).
      const ids = new Set<string>([id])
      let foundNew = true
      while (foundNew) {
        foundNew = false
        current.nodes.forEach((node) => {
          if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
            ids.add(node.id)
            foundNew = true
          }
        })
      }

      // Nos imutaveis (builtin que nao pode ser excluido) ficam de fora da
      // selecao, mesmo que estivessem dentro da arvore marcada acima.
      const deleted = current.nodes.filter((node) => ids.has(node.id) && !node.immutable)
      if (deleted.length === 0) return current
      const deletedIds = new Set(deleted.map((node) => node.id))
      const deletedAt = new Date().toISOString()
      const trash: OrganizerTrashEntry[] = deleted.map((node) => ({
        id: createOrganizerId('trash'),
        kind: 'node',
        label: node.name,
        deletedAt,
        payload: node,
      }))

      return withActivity(
        {
          ...current,
          nodes: current.nodes
            .filter((node) => !deletedIds.has(node.id))
            .map((node) => ({
              ...node,
              itemIds: node.itemIds.filter((itemId) => !deletedIds.has(itemId)),
            })),
          trash: [...trash, ...current.trash],
        },
        activity(
          `${deleted[0].name} movido para a lixeira`,
          `${deleted.length} registro(s) removido(s)`,
          null,
        ),
      )
    })
  }

  // Move uma tag para a lixeira e remove a referencia dela de qualquer no
  // que a usava (um item nao pode ficar marcado com uma tag que nao existe mais).
  function moveTagToTrash(id: string) {
    setLocalStore((current) => {
      const tag = current.tags.find((item) => item.id === id)
      if (!tag) return current
      const trashEntry: OrganizerTrashEntry = {
        id: createOrganizerId('trash'),
        kind: 'tag',
        label: tag.name,
        deletedAt: new Date().toISOString(),
        payload: tag,
      }
      return withActivity(
        {
          ...current,
          tags: current.tags.filter((item) => item.id !== id),
          nodes: current.nodes.map((node) => ({
            ...node,
            tagIds: node.tagIds.filter((tagId) => tagId !== id),
          })),
          trash: [trashEntry, ...current.trash],
        },
        activity(`${tag.name} movida para a lixeira`, 'Tag removida', null),
      )
    })
  }

  // Restaura uma entrada da lixeira (no ou tag) de volta para a arvore ativa.
  function restoreTrash(id: string) {
    setLocalStore((current) => {
      const entry = current.trash.find((item) => item.id === id)
      if (!entry) return current

      let trash = current.trash
      let nodes = current.nodes
      let tags = current.tags

      // Restaura um no e, recursivamente, qualquer ancestral dele que
      // tambem esteja na lixeira (ex.: restaurar um item cuja subpasta-pai
      // tambem foi excluida) - sem isso o no voltaria com um parentId que
      // nao existe mais na arvore. Se o ancestral nao estiver na lixeira
      // (foi excluido definitivamente), o no e realocado para "home" em vez
      // de ficar orfao.
      const restoreNode = (nodeEntry: OrganizerTrashEntry) => {
        trash = trash.filter((item) => item.id !== nodeEntry.id)
        let node = nodeEntry.payload as OrganizerNode
        if (node.parentId && !nodes.some((existing) => existing.id === node.parentId)) {
          const ancestorEntry = trash.find(
            (item) => item.kind === 'node' && (item.payload as OrganizerNode).id === node.parentId,
          )
          if (ancestorEntry) restoreNode(ancestorEntry)
          else node = { ...node, parentId: 'home' }
        }
        nodes = [...nodes, node]
      }

      if (entry.kind === 'node') {
        restoreNode(entry)
      } else {
        trash = trash.filter((item) => item.id !== id)
        tags = [...tags, entry.payload as OrganizerTag]
      }

      return withActivity(
        { ...current, trash, nodes, tags },
        activity(`${entry.label} restaurado`, 'Item recuperado da lixeira', null),
      )
    })
  }

  // Remove uma entrada da lixeira para sempre (sem volta), e limpa do feed
  // de atividades qualquer entrada relacionada a ela (pelo id do alvo ou
  // pelo label, que comeca com o nome do item excluido).
  function deleteTrashPermanently(id: string) {
    setLocalStore((current) => {
      const entry = current.trash.find((item) => item.id === id)
      if (!entry) return current
      const payloadId = entry.payload.id
      return {
        ...current,
        trash: current.trash.filter((item) => item.id !== id),
        activities: current.activities.filter(
          (item) => item.targetId !== payloadId && !item.label.startsWith(entry.label),
        ),
      }
    })
  }

  // Esvazia o feed de "Atividade recente" sem afetar nos, tags ou lixeira.
  function clearActivities() {
    setLocalStore((current) => ({ ...current, activities: [] }))
  }

  // Descarta toda a customizacao e volta a store para o estado inicial
  // (seed padrao de paginas/modulos) - usado para "zerar" o Organizador.
  function resetWorkspace() {
    setLocalStore(initialOrganizerStore)
  }

  // Expoe o estado atual da store e todas as acoes de CRUD sobre ela.
  return {
    store,
    createNode,
    createTag,
    updateNode,
    updateTag,
    recordAccess,
    duplicateNode,
    moveNode,
    moveNodeToTrash,
    moveTagToTrash,
    restoreTrash,
    deleteTrashPermanently,
    clearActivities,
    resetWorkspace,
  }
}
