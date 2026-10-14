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

function storesAreEqual(left: OrganizerStore, right: OrganizerStore) {
  return JSON.stringify(left) === JSON.stringify(right)
}

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

function loadOrganizerStore(): OrganizerStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialOrganizerStore

    const parsed = JSON.parse(saved) as Partial<OrganizerStore>
    const savedNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
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

function activity(label: string, detail: string, targetId: string | null): OrganizerActivity {
  return {
    id: createOrganizerId('activity'),
    label,
    detail,
    targetId,
    createdAt: new Date().toISOString(),
  }
}

function withActivity(store: OrganizerStore, nextActivity: OrganizerActivity): OrganizerStore {
  const visibleDuplicate = store.activities
    .slice(0, VISIBLE_RECENT_LIMIT)
    .find((entry) => entry.label === nextActivity.label && entry.detail === nextActivity.detail)
  const activities = visibleDuplicate
    ? store.activities.filter((entry) => entry.id !== visibleDuplicate.id)
    : store.activities

  return { ...store, activities: [nextActivity, ...activities].slice(0, 50) }
}

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

export function useOrganizerStore(token?: string) {
  const [store, setStore] = useState<OrganizerStore>(loadOrganizerStore)
  const [remoteReady, setRemoteReady] = useState(false)
  const storeRef = useRef(store)
  const pendingLocalSave = useRef(false)
  const localRevision = useRef(0)
  const hasSyncedWithServer = useRef(false)
  const isPutInFlight = useRef(false)
  const latestSnapshotToPut = useRef<OrganizerStore | null>(null)
  const isOrganizerRoute = window.location.pathname === '/admin'
  // Salvar (PUT) agora exige o token de administrador; ler (GET) continua
  // publico porque o site inteiro depende da estrutura para renderizar.
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])

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

  useEffect(() => {
    storeRef.current = store
  }, [store])

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

  useEffect(() => {
    if (isOrganizerRoute) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    }
    window.dispatchEvent(new CustomEvent<OrganizerStore>(SYNC_EVENT, { detail: store }))
  }, [isOrganizerRoute, store])

  useEffect(() => {
    let cancelled = false

    const applyRemoteStore = (remoteStore: OrganizerStore) => {
      // Antes da primeira sincronizacao, o estado local e so o esqueleto padrao
      // (loadOrganizerStore ainda nao confirmou os dados reais) - uma edicao feita
      // nesse instante nao pode bloquear a chegada dos dados reais do servidor,
      // senao esse esqueleto acaba sendo salvo por cima deles.
      if (hasSyncedWithServer.current && (pendingLocalSave.current || withinEditCooldown())) return
      hasSyncedWithServer.current = true

      if (isOrganizerRoute) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteStore))
        const normalizedStore = loadOrganizerStore()
        setStore((current) => (storesAreEqual(current, normalizedStore) ? current : normalizedStore))
        return
      }
      setStore((current) => (storesAreEqual(current, remoteStore) ? current : remoteStore))
    }

    const syncFromServer = async (allowInitialize: boolean) => {
      const revisionAtStart = localRevision.current
      try {
        const remoteStore = await api.get<OrganizerStore | null>('/organizer')
        if (cancelled) return
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

  function createNode(input: CreateOrganizerNodeInput) {
    const timestamp = new Date().toISOString()
    const baseSlug = input.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const requestedRoute = input.route?.trim()
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


  function recordAccess(id: string, label: string) {
    setLocalStore((current) => withActivity(current, activity(label, 'Aberto no organizador', id)))
  }

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

  function moveNode(id: string, direction: 'up' | 'down') {
    setLocalStore((current) => {
      const currentNode = current.nodes.find((node) => node.id === id)
      if (!currentNode || currentNode.immutable) return current

      const siblings = current.nodes.filter((node) => node.parentId === currentNode.parentId)
      const siblingIndex = siblings.findIndex((node) => node.id === id)
      const targetSibling = siblings[siblingIndex + (direction === 'up' ? -1 : 1)]
      if (!targetSibling || targetSibling.immutable) return current

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

  function moveNodeToTrash(id: string) {
    setLocalStore((current) => {
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

  function restoreTrash(id: string) {
    setLocalStore((current) => {
      const entry = current.trash.find((item) => item.id === id)
      if (!entry) return current

      let trash = current.trash
      let nodes = current.nodes
      let tags = current.tags

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

  function clearActivities() {
    setLocalStore((current) => ({ ...current, activities: [] }))
  }

  function resetWorkspace() {
    setLocalStore(initialOrganizerStore)
  }

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
