import { Camera, ChevronDown, ChevronLeft, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  organizerItemStatusOptions,
  organizerStatusLabels,
  type ItemWizardDraft,
  type ItemWizardStep,
  type OrganizerNode,
  type OrganizerStatus,
  type OrganizerTag,
} from '../../types/organizer'

interface ItemWizardProps {
  step: ItemWizardStep
  draft: ItemWizardDraft
  onDraftChange: (changes: Partial<ItemWizardDraft>) => void
  onStepChange: (step: ItemWizardStep) => void
  nodes: OrganizerNode[]
  discountTags: OrganizerTag[]
  onCancel: () => void
  onFinish: () => void
}

function readFilesAsDataUrls(files: FileList): Promise<string[]> {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.addEventListener('load', () => resolve(String(reader.result)))
          reader.addEventListener('error', () => reject(reader.error))
          reader.readAsDataURL(file)
        }),
    ),
  )
}

export function ItemWizard({
  step,
  draft,
  onDraftChange,
  onStepChange,
  nodes,
  discountTags,
  onCancel,
  onFinish,
}: ItemWizardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const step1NameInputRef = useRef<HTMLInputElement>(null)
  const step3NameInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const [fieldError, setFieldError] = useState<'name' | 'price' | null>(null)
  const [appearsOpen, setAppearsOpen] = useState(false)

  // Mesma logica da gaveta "Aparece em" do painel de propriedades, so que
  // aqui o item ainda nao existe - as selecoes ficam no draft e so viram
  // itemIds reais dos blocos quando o cadastro e finalizado.
  const placementBlocks = nodes.filter((candidate) => candidate.type === 'carousel' || candidate.type === 'catalog')
  const placementsByPage = new Map<string, OrganizerNode[]>()
  placementBlocks.forEach((block) => {
    const pageName = nodes.find((candidate) => candidate.id === block.parentId)?.name ?? 'Outros'
    const list = placementsByPage.get(pageName) ?? []
    list.push(block)
    placementsByPage.set(pageName, list)
  })
  const togglePlacement = (blockId: string) => {
    const current = draft.placementIds
    const next = current.includes(blockId)
      ? current.filter((value) => value !== blockId)
      : [...current, blockId]
    onDraftChange({ placementIds: next })
  }

  useEffect(() => {
    if (fieldError === 'name' && step === 1) {
      step1NameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      step1NameInputRef.current?.focus()
    }
    if (fieldError === 'price' && step === 3) {
      priceInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      priceInputRef.current?.focus()
    }
  }, [fieldError, step])

  const handleFinish = () => {
    if (!draft.name.trim()) {
      setFieldError('name')
      onStepChange(1)
      return
    }
    if (!(Number(draft.price) > 0)) {
      setFieldError('price')
      onStepChange(3)
      return
    }
    setFieldError(null)
    onFinish()
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newPhotos = await readFilesAsDataUrls(files)
    onDraftChange({ photos: [...draft.photos, ...newPhotos] })
  }

  const removePhoto = (index: number) => {
    onDraftChange({ photos: draft.photos.filter((_, photoIndex) => photoIndex !== index) })
  }

  const progress = (step / 3) * 100

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center justify-between bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-5 py-3">
        <h1 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Cadastrar item</h1>
        <button
          type="button"
          aria-label="Cancelar cadastro"
          onClick={onCancel}
          className="rounded-full p-1 text-white/90 hover:bg-white/15 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-6">
        {step === 1 && (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <p className="mb-4 text-lg font-semibold text-[#3a164f]">Como se chama o produto?</p>
            <input
              ref={step1NameInputRef}
              autoFocus
              value={draft.name}
              onChange={(event) => {
                onDraftChange({ name: event.target.value })
                if (event.target.value.trim()) setFieldError(null)
              }}
              placeholder="Nome do item"
              className={`organizer-input max-w-xs text-center ${fieldError === 'name' ? 'border-[#a0382f] ring-4 ring-[#a0382f]/15' : ''}`}
            />
            {fieldError === 'name' ? (
              <p className="mt-2 text-xs font-medium text-[#a0382f]">Informe o nome do produto.</p>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 py-2">
            {draft.photos.length === 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Adicionar fotos"
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] text-white shadow-[var(--shadow-organizer)] hover:brightness-110"
                >
                  <Camera size={30} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-full border border-[#5b247f] px-4 py-2 text-xs font-semibold text-[#3a164f] hover:bg-[#eadcf0]"
                >
                  <Plus size={14} /> Adicionar fotos
                </button>
              </>
            ) : (
              <div className="w-full max-w-xl">
                <PhotoGrid photos={draft.photos} onRemovePhoto={removePhoto} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#5b247f] px-4 py-2.5 text-xs font-semibold text-[#3a164f] hover:bg-[#eadcf0]"
                >
                  <Plus size={14} /> Adicionar mais
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mx-auto grid w-full max-w-xl gap-4">
            <div className="flex gap-2">
              <div className="flex h-24 w-20 shrink-0 flex-col gap-2 overflow-y-auto">
                {draft.photos.slice(1).map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt=""
                    className="h-11 w-full shrink-0 rounded-lg border-2 border-[#d89a28] object-cover"
                  />
                ))}
              </div>
              <div className="h-24 flex-1 overflow-hidden rounded-xl border-2 border-[#d89a28] bg-[#fff1d6]">
                {draft.photos[0] ? (
                  <img src={draft.photos[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#b77717]">
                    <Camera size={24} />
                  </div>
                )}
              </div>
            </div>

            <label>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                Nome
              </span>
              <input
                ref={step3NameInputRef}
                value={draft.name}
                onChange={(event) => {
                  onDraftChange({ name: event.target.value })
                  if (event.target.value.trim()) setFieldError(null)
                }}
                className={`organizer-input ${fieldError === 'name' ? 'border-[#a0382f] ring-4 ring-[#a0382f]/15' : ''}`}
              />
              {fieldError === 'name' ? (
                <p className="mt-1 text-[10px] font-medium text-[#a0382f]">Informe o nome do produto.</p>
              ) : null}
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                Descrição
              </span>
              <textarea
                value={draft.description}
                onChange={(event) => {
                  onDraftChange({ description: event.target.value })
                  event.currentTarget.style.height = 'auto'
                  event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`
                }}
                rows={3}
                className="organizer-input resize-none overflow-hidden"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                Status
              </span>
              <select
                value={draft.status}
                onChange={(event) => onDraftChange({ status: event.target.value as OrganizerStatus })}
                className="organizer-input"
              >
                {organizerItemStatusOptions.map((value) => (
                  <option key={value} value={value}>
                    {organizerStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            {draft.status !== 'draft' && (
              <div className="rounded-xl border border-stone-200 bg-white">
                <button
                  type="button"
                  onClick={() => setAppearsOpen((value) => !value)}
                  aria-expanded={appearsOpen}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b665f]">
                    Aparece em
                  </span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 text-[#6b665f] transition-transform ${appearsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {appearsOpen && (
                  <div className="max-h-48 overflow-y-auto border-t border-stone-200">
                    {placementBlocks.length === 0 ? (
                      <p className="p-2.5 text-[10px] text-[#6b665f]">
                        Nenhum carrossel ou catálogo criado ainda nas páginas do site.
                      </p>
                    ) : (
                      Array.from(placementsByPage.entries()).map(([pageName, blocks]) => (
                        <div key={pageName}>
                          <div className="bg-[#fff1d6] px-2.5 py-1.5 text-[10px] font-semibold text-[#8b5200]">
                            {pageName}
                          </div>
                          {blocks.map((block) => (
                            <label
                              key={block.id}
                              className="flex items-center gap-2 border-t border-stone-100 px-2.5 py-1.5 pl-5 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={draft.placementIds.includes(block.id)}
                                onChange={() => togglePlacement(block.id)}
                                className="accent-[#d89a28]"
                              />
                              <span className="truncate">{block.name}</span>
                            </label>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                  Valor
                </span>
                <div
                  className={`flex items-center rounded-xl border bg-white px-3 focus-within:border-[#d89a28] focus-within:ring-4 focus-within:ring-[#f7dfb1] ${fieldError === 'price' ? 'border-[#a0382f] ring-4 ring-[#a0382f]/15' : 'border-stone-200'}`}
                >
                  <input
                    ref={priceInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.price}
                    onChange={(event) => {
                      onDraftChange({ price: event.target.value })
                      if (Number(event.target.value) > 0) setFieldError(null)
                    }}
                    placeholder="0,00"
                    className="w-full bg-transparent py-2 text-xs text-[#2a0f3d] outline-none"
                  />
                  <span className="text-[10px] text-[#6b665f]">R$</span>
                </div>
                {fieldError === 'price' ? (
                  <p className="mt-1 text-[10px] font-medium text-[#a0382f]">Informe o preço de venda.</p>
                ) : null}
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                  Tag
                </span>
                <select
                  value={draft.tagId}
                  onChange={(event) => onDraftChange({ tagId: event.target.value })}
                  className="organizer-input"
                >
                  <option value="">Sem desconto</option>
                  {discountTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name} · {tag.discountPercent}%
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                  Estoque
                </span>
                <input
                  type="number"
                  min="0"
                  value={draft.stock}
                  onChange={(event) => onDraftChange({ stock: event.target.value })}
                  placeholder="Quantidade disponível"
                  className="organizer-input"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                  Desconto no Pix (%)
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.pixDiscountPercent}
                  onChange={(event) => onDraftChange({ pixDiscountPercent: event.target.value })}
                  placeholder="5"
                  className="organizer-input"
                />
              </label>
            </div>
            <p className="-mt-2 text-[10px] text-[#6b665f]">
              Estoque: ao chegar a 0, o status muda sozinho para "Em breve". Pix: deixe em branco para usar o
              padrão do site.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                  Marca
                </span>
                <input
                  value={draft.brand}
                  onChange={(event) => onDraftChange({ brand: event.target.value })}
                  placeholder="Nome da marca"
                  className="organizer-input"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                  Atributo numérico (opcional)
                </span>
                <input
                  type="number"
                  min="0"
                  value={draft.volumeMl}
                  onChange={(event) => onDraftChange({ volumeMl: event.target.value })}
                  placeholder="Ex.: 100 (ml, g, W...)"
                  className="organizer-input"
                />
              </label>
            </div>
            <p className="-mt-2 text-[10px] text-[#6b665f]">
              Marca e atributo aparecem nos filtros do catálogo.
            </p>

            <label>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">
                Código
              </span>
              <input
                value={draft.sku}
                onChange={(event) => onDraftChange({ sku: event.target.value })}
                placeholder="Código interno do item"
                className="organizer-input"
              />
              <p className="mt-1 text-[10px] text-[#6b665f]">
                Uso interno: nunca aparece na página pública do item.
              </p>
            </label>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <div className="mb-4 h-1.5 w-full rounded-full bg-[#ababab]">
        <div
          className="h-full rounded-full bg-[#d89a28] transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (step === 1 ? onCancel() : onStepChange((step - 1) as ItemWizardStep))}
          className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#3a164f] hover:border-[#d89a28] hover:bg-[#fff8ea]"
        >
          <ChevronLeft size={15} /> Voltar
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={step === 1 && !draft.name.trim()}
            onClick={() => onStepChange((step + 1) as ItemWizardStep)}
            className="rounded-full bg-[#d89a28] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c28a1f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            className="rounded-full bg-[#d89a28] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c28a1f]"
          >
            Finalizar
          </button>
        )}
      </div>
    </div>
  )
}

function PhotoGrid({ photos, onRemovePhoto }: { photos: string[]; onRemovePhoto: (index: number) => void }) {
  return (
    <div className="grid gap-2">
      <PhotoPreview src={photos[0]} onRemove={() => onRemovePhoto(0)} className="h-56 w-full" />
      {photos.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.slice(1).map((photo, index) => (
            <PhotoPreview
              key={index}
              src={photo}
              onRemove={() => onRemovePhoto(index + 1)}
              className="h-28 w-full"
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoPreview({
  src,
  onRemove,
  className = '',
}: {
  src: string
  onRemove: () => void
  className?: string
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border-2 border-[#d89a28] bg-[#fff1d6] ${className}`}
    >
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        aria-label="Remover foto"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-[#a0382f] shadow hover:bg-white"
      >
        <X size={13} />
      </button>
    </div>
  )
}
