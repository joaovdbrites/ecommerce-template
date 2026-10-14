import { Eye, Layers3, LayoutGrid, Package, Sparkles, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { CreateOrganizerNodeInput } from '../../hooks/useOrganizerStore'
import {
  organizerDiscountOptions,
  organizerSizeLabels,
  organizerStatusLabels,
  organizerTypeLabels,
  findOrganizerPage,
  getOrganizerPageModules,
  isOrganizerNodeVisible,
  type OrganizerContentType,
  type OrganizerNode,
  type OrganizerStore,
} from '../../types/organizer'

export type OrganizerModalMode =
  | OrganizerContentType
  | 'tag'
  | 'preview'
  | 'module-picker'
  | null

type OrganizerModalProps = {
  mode: Exclude<OrganizerModalMode, null>
  store: OrganizerStore
  parentId: string
  selectedId: string | null
  onClose: () => void
  onCreateNode: (input: CreateOrganizerNodeInput) => string
  onCreateTag: (name: string, color: string, discountPercent?: number) => string
  onCreated: (kind: 'node' | 'tag', id: string) => void
  onChooseModule: (type: 'carousel' | 'highlight' | 'catalog') => void
}

const fieldClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#2a0f3d] outline-none focus:border-[#b77717] focus:ring-2 focus:ring-[#fff1d6]'

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-[#6b665f]">
      {children}
    </span>
  )
}

export function OrganizerModal({
  mode,
  store,
  parentId,
  selectedId,
  onClose,
  onCreateNode,
  onCreateTag,
  onCreated,
  onChooseModule,
}: OrganizerModalProps) {
  // Subpasta so existe dentro de "Itens" (sem escolha, ver handleSubmit).
  // Carrossel/catalogo/destaque so numa pagina do site de verdade - nunca em
  // "Itens" nem nas subpastas dela, que guardam so os itens.
  const containers = store.nodes.filter(
    (node) =>
      (node.type === 'page' && node.id !== 'itens') ||
      (node.type === 'folder' && findOrganizerPage(store.nodes, node)?.id !== 'itens'),
  )
  const items = store.nodes.filter((node) => node.type === 'item' && findOrganizerPage(store.nodes, node))
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [route, setRoute] = useState('')
  const [publicationStatus, setPublicationStatus] = useState<OrganizerNode['status']>('published')
  const [selectedParent, setSelectedParent] = useState(parentId || 'home')
  const [lastParentId, setLastParentId] = useState(parentId)
  if (parentId !== lastParentId) {
    setLastParentId(parentId)
    setSelectedParent(parentId || 'home')
  }
  const [imageUrl, setImageUrl] = useState('')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState<OrganizerNode['size']>('medium')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [itemIds, setItemIds] = useState<string[]>([])
  const [color, setColor] = useState('#d89a28')
  const [discountPercent, setDiscountPercent] = useState('')
  const suggestedRoute = `/pagina/${
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'nova-pagina'
  }`

  const title =
    mode === 'tag'
      ? 'Criar tag'
      : mode === 'preview'
        ? 'Pré-visualização do site'
        : mode === 'module-picker'
          ? 'Escolha o primeiro módulo'
          : `Criar ${organizerTypeLabels[mode].toLocaleLowerCase('pt-BR')}`

  function toggleValue(values: string[], value: string, setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'preview' || mode === 'module-picker') return

    if (mode === 'tag') {
      if (!name.trim()) return
      const id = onCreateTag(name, color, discountPercent ? Number(discountPercent) : undefined)
      onClose()
      onCreated('tag', id)
      return
    }

    if (!name.trim()) return
    const id = onCreateNode({
      name,
      type: mode,
      // Subpasta so existe dentro de "Itens": nao depende do seletor abaixo
      // (que nem aparece para esse modo), sempre vai para la.
      parentId: mode === 'page' ? null : mode === 'folder' ? 'itens' : selectedParent,
      description,
      imageUrl,
      price: Number(price) || 0,
      size,
      tagIds,
      itemIds,
      route: mode === 'page' ? route || suggestedRoute : undefined,
      status: mode === 'folder' ? 'published' : publicationStatus,
    })
    onClose()
    onCreated('node', id)
  }

  function handleImageFile(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result)
    })
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Fechar janela"
        className="absolute inset-0 bg-[#3a164f]/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden border border-[color:var(--color-primary)]/40 bg-[#fafaf8] shadow-[var(--shadow-window)]"
        style={{ borderRadius: 'var(--radius-window)' }}
      >
        <header className="flex items-center justify-between bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-dark)_100%)] px-5 py-4 text-[#fafaf8]">
          <div className="flex items-center gap-3">
            {mode === 'preview' ? <Eye size={19} className="text-[#e2b04f]" /> : null}
            <h2 className="font-sans text-base font-semibold tracking-normal">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </header>

        {mode === 'preview' ? (
          <PreviewContent store={store} selectedId={selectedId} />
        ) : mode === 'module-picker' ? (
          <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleChoice
              icon={<Layers3 size={22} />}
              title="Carrossel"
              detail="Uma faixa deslizante com itens da loja."
              onClick={() => {
                onClose()
                onChooseModule('carousel')
              }}
            />
            <ModuleChoice
              icon={<Sparkles size={22} />}
              title="Destaque"
              detail="Um banner visual com imagem e descrição."
              onClick={() => {
                onClose()
                onChooseModule('highlight')
              }}
            />
            <ModuleChoice
              icon={<LayoutGrid size={22} />}
              title="Catálogo"
              detail="Uma grade paginada no modelo das categorias."
              onClick={() => {
                onClose()
                onChooseModule('catalog')
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 text-sm text-[#6b665f] hover:bg-[#fff8ea] sm:col-span-2 lg:col-span-3"
            >
              Criar apenas a página
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto p-5">
            <div className="grid gap-4">
              <label>
                <FieldLabel>Nome</FieldLabel>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={fieldClass}
                      autoFocus
                      required
                    />
                  </label>

                  {mode !== 'tag' ? (
                    <label>
                      <FieldLabel>Descrição</FieldLabel>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className={`${fieldClass} min-h-24 resize-y`}
                      />
                    </label>
                  ) : null}

                  {mode === 'page' ? (
                    <>
                      <label>
                        <FieldLabel>Endereço da página</FieldLabel>
                        <input
                          value={route || suggestedRoute}
                          onChange={(event) => setRoute(event.target.value)}
                          className={fieldClass}
                          placeholder="/pagina/nome-da-pagina"
                          required
                        />
                        <span className="mt-1 block text-[10px] text-[#6b665f]">
                          A página será aberta neste endereço dentro do site existente.
                        </span>
                      </label>
                      <label>
                        <FieldLabel>Exibição na navegação</FieldLabel>
                        <select
                          value={publicationStatus}
                          onChange={(event) =>
                            setPublicationStatus(event.target.value as OrganizerNode['status'])
                          }
                          className={fieldClass}
                        >
                          <option value="published">Publicar</option>
                          <option value="draft">Rascunho</option>
                        </select>
                        <span className="mt-1 block text-[10px] text-[#6b665f]">
                          {publicationStatus === 'draft'
                            ? 'O rascunho aparece somente na visualização aberta pelo Modo visitante.'
                            : 'Páginas publicadas entram automaticamente na navegação do site.'}
                        </span>
                      </label>
                    </>
                  ) : null}

                  {mode !== 'page' && mode !== 'tag' ? (
                    <>
                      {mode !== 'folder' && (
                        <label>
                          <FieldLabel>Página de destino</FieldLabel>
                          <select
                            value={selectedParent}
                            onChange={(event) => setSelectedParent(event.target.value)}
                            className={fieldClass}
                            required
                          >
                            {containers.map((container) => (
                              <option key={container.id} value={container.id}>
                                {container.type === 'folder' ? '↳ ' : ''}
                                {container.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {mode !== 'folder' ? (
                        <label>
                          <FieldLabel>Publicação no site</FieldLabel>
                          <select
                            value={publicationStatus}
                            onChange={(event) =>
                              setPublicationStatus(event.target.value as OrganizerNode['status'])
                            }
                            className={fieldClass}
                          >
                            <option value="published">Publicar e mostrar agora</option>
                            <option value="draft">Salvar como rascunho oculto</option>
                          </select>
                        </label>
                      ) : (
                        <p className="rounded-xl border border-stone-200 bg-[#fff8ea] px-3 py-2.5 text-xs leading-5 text-[#6b665f]">
                          Fica dentro de Itens, junto das outras subpastas. Serve só para organizar os itens -
                          não cria endereço nem aparece na navegação do site.
                        </p>
                      )}
                    </>
                  ) : null}

                  {mode === 'tag' ? (
                    <>
                      <label>
                        <FieldLabel>Cor</FieldLabel>
                        <input
                          type="color"
                          value={color}
                          onChange={(event) => setColor(event.target.value)}
                          className="h-11 w-full rounded-xl border border-stone-200 bg-white p-1"
                        />
                      </label>
                      <label>
                        <FieldLabel>Desconto</FieldLabel>
                        <select
                          value={discountPercent}
                          onChange={(event) => setDiscountPercent(event.target.value)}
                          className={fieldClass}
                        >
                          <option value="">Nenhum (tag comum)</option>
                          {organizerDiscountOptions.map((percent) => (
                            <option key={percent} value={percent}>
                              {percent}% de desconto
                            </option>
                          ))}
                        </select>
                        <span className="mt-1 block text-[10px] text-[#6b665f]">
                          Tags de desconto podem ser usadas na etapa final do cadastro de itens.
                        </span>
                      </label>
                    </>
                  ) : null}

                  {mode === 'highlight' || mode === 'item' ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label>
                        <FieldLabel>Imagem por endereço</FieldLabel>
                        <input
                          type="text"
                          value={imageUrl.startsWith('data:') ? '' : imageUrl}
                          onChange={(event) => setImageUrl(event.target.value)}
                          className={fieldClass}
                          placeholder="https://..."
                        />
                      </label>
                      <label className="cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-center text-xs font-semibold text-[#3a164f] hover:border-[#b77717] hover:bg-[#fff1d6]">
                        Enviar arquivo
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => handleImageFile(event.target.files?.[0])}
                        />
                      </label>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Prévia"
                          className="h-24 w-full rounded-xl object-cover sm:col-span-2"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {mode === 'highlight' ? (
                    <label>
                      <FieldLabel>Tamanho do destaque</FieldLabel>
                      <select
                        value={size}
                        onChange={(event) => setSize(event.target.value as OrganizerNode['size'])}
                        className={fieldClass}
                      >
                        {Object.entries(organizerSizeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {mode === 'item' ? (
                    <>
                      <label>
                        <FieldLabel>Preço</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={(event) => setPrice(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <CheckboxGrid
                        title="Tags"
                        empty="Crie uma tag antes de associá-la."
                        entries={store.tags.map((tag) => ({ id: tag.id, label: tag.name }))}
                        selected={tagIds}
                        onToggle={(id) => toggleValue(tagIds, id, setTagIds)}
                      />
                    </>
                  ) : null}

                  {mode === 'carousel' || mode === 'catalog' ? (
                    <ProductCheckboxGrid
                      title={mode === 'catalog' ? 'Produtos do catálogo' : 'Itens do carrossel'}
                      empty={`Crie itens antes de adicioná-los ao ${mode === 'catalog' ? 'catálogo' : 'carrossel'}.`}
                      items={items}
                      selected={itemIds}
                      onToggle={(id) => toggleValue(itemIds, id, setItemIds)}
                    />
                  ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-stone-200/80 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#6b665f] hover:bg-[#fff8ea]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-full bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-organizer)] hover:brightness-110"
              >
                Criar
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function ModuleChoice({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-stone-200 bg-white p-5 text-left hover:border-[#b77717] hover:bg-[#fff8ea]"
    >
      <span className="mb-3 inline-flex rounded-full bg-[#fff1d6] p-3 text-[#b77717]">{icon}</span>
      <span className="block text-sm font-semibold text-[#3a164f]">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-[#6b665f]">{detail}</span>
    </button>
  )
}

function CheckboxGrid({
  title,
  empty,
  entries,
  selected,
  onToggle,
}: {
  title: string
  empty: string
  entries: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <fieldset>
      <legend>
        <FieldLabel>{title}</FieldLabel>
      </legend>
      {entries.length === 0 ? (
        <p className="text-xs text-[#6b665f]">{empty}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {entries.map((entry) => (
            <label
              key={entry.id}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(entry.id)}
                onChange={() => onToggle(entry.id)}
              />
              {entry.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

function ProductCheckboxGrid({
  title,
  empty,
  items,
  selected,
  onToggle,
}: {
  title: string
  empty: string
  items: OrganizerNode[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <fieldset>
      <legend>
        <FieldLabel>
          {title} · {selected.length} selecionado(s)
        </FieldLabel>
      </legend>
      {items.length === 0 ? (
        <p className="text-xs text-[#6b665f]">{empty}</p>
      ) : (
        <div className="grid max-h-80 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {items.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer gap-3 border p-2.5 transition ${
                  checked
                    ? 'border-[#b77717] bg-[#fff8ea] shadow-sm'
                    : 'border-stone-200 bg-white hover:border-[#d89a28]'
                }`}
              >
                <span className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden bg-[#fff8ea] text-[#b77717]">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={24} />
                  )}
                </span>
                <span className="min-w-0 flex-1 py-1">
                  <span className="block truncate text-sm font-semibold text-[#3a164f]">{item.name}</span>
                  <span className="mt-1 block text-xs text-[#6b665f]">
                    {item.price > 0
                      ? item.price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : 'Preço não informado'}
                  </span>
                  <span className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-[#b77717]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      className="accent-[#b77717]"
                    />
                    {checked ? 'Em uso' : 'Selecionar'}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

function PreviewContent({ store, selectedId }: { store: OrganizerStore; selectedId: string | null }) {
  const selected = store.nodes.find((node) => node.id === selectedId)
  const page = selected ? findOrganizerPage(store.nodes, selected) : store.nodes[0]
  const contents = page
    ? getOrganizerPageModules(store.nodes, page.id).filter((node) => isOrganizerNodeVisible(node))
    : []

  return (
    <div className="min-h-0 overflow-y-auto bg-[#eadcf0] p-5">
      <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#b77717]">
          Visualização do visitante
        </p>
        <h3 className="mt-2 text-3xl font-semibold text-[#2a0f3d]">{page?.name ?? 'Home'}</h3>
        <p className="mt-1 text-sm text-[#6b665f]">{page?.description || 'Página do site'}</p>

        <div className="mt-6 grid gap-4">
          {contents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-[#6b665f]">
              Nenhum conteúdo publicado nesta página.
            </div>
          ) : (
            contents.map((node) => (
              <article key={node.id} className="rounded-xl border border-[#e9e2d9] bg-[#fcfbf8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b77717]">
                      {organizerTypeLabels[node.type]}
                    </p>
                    <h4 className="font-sans text-base font-semibold text-[#3a164f]">{node.name}</h4>
                  </div>
                  <span className="rounded-full bg-[#eadcf0] px-2 py-1 text-[10px] font-semibold text-[#3a164f]">
                    {organizerStatusLabels[node.status]}
                  </span>
                </div>
                {node.description ? (
                  <p className="mt-2 text-xs leading-5 text-[#6b665f]">{node.description}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
