// Os seis "tipos de conteudo" que um no do Organizador pode ser: pagina do
// site, subpasta organizacional (nao navegavel sozinha), carrossel de
// produtos, destaque/banner, catalogo (grade de produtos) ou item (produto
// individual).
export type OrganizerContentType = 'page' | 'folder' | 'carousel' | 'highlight' | 'catalog' | 'item'
// Estado de publicacao/disponibilidade de um no. "draft" fica invisivel no
// site (so aparece no preview do Organizador); os demais sao visiveis com
// apresentacoes diferentes (ver utils/itemStatus.ts).
export type OrganizerStatus =
  | 'draft'
  | 'published'
  | 'coming-soon'
  | 'out-of-stock'
  | 'low-stock'
// Tamanho relativo usado no layout de grade/carrossel.
export type OrganizerSize = 'small' | 'medium' | 'large'
// Como um no e efetivamente renderizado na pagina - geralmente decorre do
// `type`, mas existe separado porque alguns tipos admitem mais de uma
// apresentacao visual (ex.: "highlight" pode ser banner simples ou faixa de marcas).
export type OrganizerVariant =
  | 'standard'
  | 'banner'
  | 'banner-carousel'
  | 'product-carousel'
  | 'product-grid'
  | 'brand-marquee'

// Um no da arvore do Organizador - pode ser pagina, pasta, carrossel,
// catalogo, destaque ou item (ver OrganizerContentType). A arvore inteira do
// site (estrutura de navegacao + conteudo) e modelada como uma lista plana
// desses nos ligados por parentId.
export type OrganizerNode = {
  id: string
  name: string
  type: OrganizerContentType
  parentId: string | null
  description: string
  status: OrganizerStatus
  imageUrl: string
  /** Galeria completa do item (imageUrl e sempre a primeira). So "item" usa mais de uma. */
  images?: string[]
  price: number
  size: OrganizerSize
  tagIds: string[]
  itemIds: string[]
  /** So "folder" usa - carrosseis/catalogos pre-marcados em "Aparece em" para
   * todo item novo criado dentro dela (economiza marcar de novo toda vez). */
  defaultPlacementIds?: string[]
  /** So "folder" usa - liga/desliga o preenchimento automatico acima sem
   * perder a selecao ja marcada. */
  defaultPlacementEnabled?: boolean
  /** Codigo interno do item (so visivel no Organizador, nunca na pagina publica). */
  sku?: string
  /** Marca do item, usada tambem para alimentar o filtro de marcas do catalogo. */
  brand?: string
  /** Volume em ml, usado tambem para alimentar o filtro de volume do catalogo. */
  volumeMl?: number
  /** Quantidade em estoque. Ao chegar a 0, o status vira "coming-soon" automaticamente. */
  stock?: number
  /** Desconto no Pix em %, especifico do item. Sem valor, a pagina usa o padrao do site. */
  pixDiscountPercent?: number
  route?: string
  variant?: OrganizerVariant
  /** Veio do seed padrao (initialOrganizerStore), nao foi criado pelo lojista. */
  builtin?: boolean
  /** Nao pode ser movido, reordenado nem excluido pelo lojista (ex.: "home"). */
  immutable?: boolean
  createdAt: string
  updatedAt: string
}

// Uma tag que o lojista pode aplicar a itens, opcionalmente com desconto
// automatico associado (ex.: "Promocao" com 20% off).
export type OrganizerTag = {
  id: string
  name: string
  color: string
  discountPercent?: number
  createdAt: string
  updatedAt: string
}

// Uma linha do feed "Atividade recente" do Organizador (criacao, edicao,
// exclusao etc.), usada so para exibicao - nao afeta o conteudo em si.
export type OrganizerActivity = {
  id: string
  label: string
  detail: string
  targetId: string | null
  createdAt: string
}

// Um registro na lixeira: guarda o objeto original completo (no ou tag) para
// permitir restaurar exatamente como estava antes de ser excluido.
export type OrganizerTrashEntry = {
  id: string
  kind: 'node' | 'tag'
  label: string
  deletedAt: string
  payload: OrganizerNode | OrganizerTag
}

// Estado completo do Organizador: a arvore de conteudo, as tags disponiveis,
// o historico de atividades e a lixeira. E o formato salvo no backend e no
// localStorage (ver useOrganizerStore).
export type OrganizerStore = {
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  activities: OrganizerActivity[]
  trash: OrganizerTrashEntry[]
}

// Rotulos em portugues exibidos na UI do Organizador para cada enum acima.
export const organizerTypeLabels: Record<OrganizerContentType, string> = {
  page: 'Página',
  folder: 'Subpasta',
  carousel: 'Carrossel',
  highlight: 'Destaque',
  catalog: 'Catálogo',
  item: 'Item',
}

export const organizerStatusLabels: Record<OrganizerStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  'coming-soon': 'Em breve',
  'out-of-stock': 'Esgotado',
  'low-stock': 'Pouco no estoque',
}

// Opcoes de status oferecidas no formulario de um "item" (produto) - "draft"
// fica fora da lista por ser tratado como um estado interno/transicional, nao
// uma escolha disponivel no form.
export const organizerItemStatusOptions: OrganizerStatus[] = [
  'published',
  'coming-soon',
  'out-of-stock',
  'low-stock',
]

export const organizerSizeLabels: Record<OrganizerSize, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
}

// Percentuais de desconto pre-definidos oferecidos ao criar/editar uma tag
// com desconto automatico.
export const organizerDiscountOptions = [10, 20, 30, 40, 50, 60] as const

// Aplica um percentual de desconto (ex.: o da tag do item) sobre um preco.
// Sem percentual definido, devolve o preco original sem alteracao.
export function getOrganizerDiscountedPrice(price: number, percent?: number) {
  if (!percent) return price
  return price - (price * percent) / 100
}

// As tres etapas do assistente de criacao rapida de item (dados basicos,
// fotos, organizacao/precificacao).
export type ItemWizardStep = 1 | 2 | 3

// Estado (ainda em formato de formulario, com numeros como string) do
// assistente de criacao de item - so vira um OrganizerNode de verdade quando
// o wizard e concluido e os campos sao convertidos/validados.
export type ItemWizardDraft = {
  name: string
  photos: string[]
  description: string
  status: OrganizerStatus
  parentId: string
  price: string
  tagId: string
  stock: string
  pixDiscountPercent: string
  brand: string
  volumeMl: string
  sku: string
  placementIds: string[]
}

// Estado inicial (vazio) do assistente de criacao de item, ja associado a
// pasta-pai e, opcionalmente, com os locais de exibicao pre-marcados
// (herdados do defaultPlacementIds da pasta, se ela tiver essa opcao ligada).
export function emptyItemWizardDraft(parentId: string, placementIds: string[] = []): ItemWizardDraft {
  return {
    name: '',
    photos: [],
    description: '',
    status: 'published',
    parentId,
    price: '',
    tagId: '',
    stock: '',
    pixDiscountPercent: '',
    brand: '',
    volumeMl: '',
    sku: '',
    placementIds,
  }
}

// Timestamp unico compartilhado por todo o seed abaixo - so precisa de um
// valor valido de createdAt/updatedAt, a loja de verdade substitui isso
// assim que o lojista comeca a editar.
const now = new Date().toISOString()

// Seed neutro de categorias - o lojista reorganiza/renomeia tudo pelo
// proprio Organizador depois (ver AppearanceSettings para o tema visual).
const sitePages: OrganizerNode[] = [
  ['home', 'Home', '/'],
  ['categoria-a', 'Categoria A', '/categoria-a'],
  ['categoria-b', 'Categoria B', '/categoria-b'],
  ['destaques', 'Destaques', '/destaques'],
].map(([id, name, route]) => ({
  id,
  name,
  type: 'page',
  parentId: null,
  description: `Página ${name} existente no site.`,
  status: 'published',
  imageUrl: '',
  price: 0,
  size: 'large',
  tagIds: [],
  itemIds: [],
  route,
  variant: 'standard',
  builtin: true,
  immutable: id === 'home',
  createdAt: now,
  updatedAt: now,
}))

// Area interna fixa: nao e uma pagina do site (sem rota), serve so para guardar
// as subpastas que organizam os itens. Criar item ou subpasta em qualquer outro
// lugar foi removido - tudo migra para ca.
export const itensRootNode: OrganizerNode = {
  id: 'itens',
  name: 'Itens',
  type: 'page',
  parentId: null,
  description: 'Area interna com os itens da loja, organizados em subpastas. Nao aparece no site.',
  status: 'published',
  imageUrl: '',
  price: 0,
  size: 'large',
  tagIds: [],
  itemIds: [],
  route: undefined,
  variant: 'standard',
  builtin: true,
  immutable: true,
  createdAt: now,
  updatedAt: now,
}

// Nomes dos sete carrosseis de produtos padrao da home (os "modulos
// automaticos" que o backend preenche com base em comportamento/estoque).
const homeModuleNames = [
  'Visto recentemente',
  'Acabaram de chegar',
  'Recomendado para você',
  'Produtos em oferta',
  'Mais procurados',
  'Pouco no estoque',
  'Produtos a partir de X preço',
]

// Monta os nos padrao da home: banner de topo, 4 carrosseis, a faixa de
// marcas no meio e mais 3 carrosseis depois dela - a ordem nesta lista e a
// ordem de exibicao na pagina.
const homeModules: OrganizerNode[] = [
  {
    id: 'home-promotional-banners',
    name: 'Banners promocionais',
    type: 'carousel',
    parentId: 'home',
    description: 'Carrossel de destaques exibido no topo da página inicial.',
    status: 'published',
    imageUrl: '',
    price: 0,
    size: 'large',
    tagIds: [],
    itemIds: [],
    variant: 'banner-carousel',
    builtin: true,
    createdAt: now,
    updatedAt: now,
  },
  ...homeModuleNames.slice(0, 4).map((name, index) => ({
    id: `home-products-${index + 1}`,
    name,
    type: 'carousel' as const,
    parentId: 'home',
    description: 'Carrossel de produtos da página inicial.',
    status: 'published' as const,
    imageUrl: '',
    price: 0,
    size: 'medium' as const,
    tagIds: [],
    itemIds: [],
    variant: 'product-carousel' as const,
    builtin: true,
    createdAt: now,
    updatedAt: now,
  })),
  {
    id: 'home-brands',
    name: 'Marcas em destaque',
    type: 'highlight',
    parentId: 'home',
    description: 'Faixa de marcas exibida entre os carrosséis da página inicial.',
    status: 'published',
    imageUrl: '',
    price: 0,
    size: 'medium',
    tagIds: [],
    itemIds: [],
    variant: 'brand-marquee',
    builtin: true,
    createdAt: now,
    updatedAt: now,
  },
  ...homeModuleNames.slice(4).map((name, index) => ({
    id: `home-products-${index + 5}`,
    name,
    type: 'carousel' as const,
    parentId: 'home',
    description: 'Carrossel de produtos da página inicial.',
    status: 'published' as const,
    imageUrl: '',
    price: 0,
    size: 'medium' as const,
    tagIds: [],
    itemIds: [],
    variant: 'product-carousel' as const,
    builtin: true,
    createdAt: now,
    updatedAt: now,
  })),
]

// Para cada pagina de categoria (exceto a home), cria um banner de destaque
// e uma grade de produtos - o par minimo que toda pagina de categoria precisa
// pra nao ficar vazia assim que e criada.
const categoryModules: OrganizerNode[] = sitePages
  .filter((page) => page.id !== 'home')
  .flatMap((page) => [
    {
      id: `${page.id}-banner`,
      name: `Destaque ${page.name}`,
      type: 'highlight' as const,
      parentId: page.id,
      description: `Banner principal da página ${page.name}.`,
      status: 'published' as const,
      imageUrl: '',
      price: 0,
      size: 'large' as const,
      tagIds: [],
      itemIds: [],
      variant: 'banner' as const,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${page.id}-products`,
      name: page.name,
      type: 'catalog' as const,
      parentId: page.id,
      description: `Grade de produtos da página ${page.name}.`,
      status: 'published' as const,
      imageUrl: '',
      price: 0,
      size: 'medium' as const,
      tagIds: [],
      itemIds: [],
      variant: 'product-grid' as const,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    },
  ])

// Store "de fabrica" usada quando uma loja ainda nao tem nenhum dado salvo -
// ja vem com a estrutura minima de paginas e modulos para o site nao ficar
// vazio antes do lojista customizar qualquer coisa.
export const initialOrganizerStore: OrganizerStore = {
  nodes: [...sitePages, itensRootNode, ...homeModules, ...categoryModules],
  tags: [],
  activities: [],
  trash: [],
}

// Gera um id unico prefixado (ex.: "item-<uuid>"), usando crypto.randomUUID
// quando disponivel e caindo no timestamp atual como alternativa simples
// (navegadores antigos ou contextos sem crypto).
export function createOrganizerId(prefix: string) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  return `${prefix}-${id}`
}

// Codigo interno curto para itens que o usuario deixou em branco - so
// precisa ser unico o bastante pra nao colidir em uso normal, nunca aparece
// na pagina publica do item (e so pra controle interno/planilha).
export function generateItemSku() {
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `SKU-${random}`.toUpperCase()
}

// Normaliza um texto para comparacao de busca: remove acentos e caixa, pra
// "A\u00e7a\u00ed" e "acai" serem considerados a mesma busca.
export function normalizeOrganizerSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

// Um no e visivel ao publico quando nao esta em rascunho - os demais status
// (publicado, em breve, esgotado, pouco estoque) aparecem no site, so com
// apresentacoes diferentes.
export function isOrganizerNodeVisible(node: OrganizerNode) {
  return node.status !== 'draft'
}

// Detecta o modo de preview do Organizador pela query string (?preview=organizer),
// que faz o site mostrar conteudo em rascunho para o lojista revisar antes de publicar.
export function isOrganizerPreviewMode(search: string) {
  return new URLSearchParams(search).get('preview') === 'organizer'
}

// Acrescenta o parametro de preview a um path interno, preservando os demais
// query params e o hash. Usa um dominio fake como base so para poder usar a
// API de URL com paths relativos.
export function withOrganizerPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path
  const url = new URL(path, 'https://organizer.local')
  url.searchParams.set('preview', 'organizer')
  return `${url.pathname}${url.search}${url.hash}`
}

// Um no esta disponivel para quem esta vendo agora se o modo preview estiver
// ligado (ve tudo, inclusive rascunhos) ou se o no ja for publicamente visivel.
export function isOrganizerNodeAvailable(node: OrganizerNode, previewMode: boolean) {
  return previewMode || isOrganizerNodeVisible(node)
}

// Sobe na arvore a partir de um no (ou id) ate achar a pagina ancestral mais
// proxima - usado para saber em qual rota um modulo/item deve aparecer. O
// Set `visited` protege contra um loop infinito caso a arvore tenha uma
// referencia circular de parentId (nao deveria acontecer, mas evita travar o app).
export function findOrganizerPage(nodes: OrganizerNode[], nodeOrId: OrganizerNode | string) {
  let current = typeof nodeOrId === 'string' ? nodes.find((node) => node.id === nodeOrId) : nodeOrId
  const visited = new Set<string>()

  while (current && current.type !== 'page' && current.parentId && !visited.has(current.id)) {
    visited.add(current.id)
    current = nodes.find((node) => node.id === current?.parentId)
  }

  return current?.type === 'page' ? current : undefined
}

// Lista os modulos (carrosseis, destaques, catalogos) exibidos em uma
// pagina, "achatando" subpastas recursivamente - uma subpasta nao e exibida
// diretamente, so serve para organizar; o que aparece na pagina sao os nos
// de conteudo dentro dela (e dentro das subpastas dela, e assim por diante).
export function getOrganizerPageModules(nodes: OrganizerNode[], pageId: string) {
  const modules: OrganizerNode[] = []
  const visited = new Set<string>()

  const appendChildren = (parentId: string) => {
    if (visited.has(parentId)) return
    visited.add(parentId)
    nodes
      .filter((node) => node.parentId === parentId)
      .forEach((node) => {
        if (node.type === 'folder') appendChildren(node.id)
        else modules.push(node)
      })
  }

  appendChildren(pageId)
  return modules
}
