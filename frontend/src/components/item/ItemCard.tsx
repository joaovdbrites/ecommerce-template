import { Package } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { trackProductEvent } from '../../services/productEvents'
import type { OrganizerStatus } from '../../types/organizer'
import { getItemStatusPresentation } from '../../utils/itemStatus'
import { itemCardToProduct } from '../../utils/productModel'
import { itemIcons } from './icons'

// Dados de um produto necessarios para desenhar o card (subconjunto do produto
// completo), usado tanto nas listagens do catalogo quanto nos carrosseis.
export type ItemCardContent = {
  id: string
  name: string
  description?: string
  imageUrl?: string
  images?: string[]
  price?: number
  tagLabel?: string
  createdAt?: string
  sku?: string
  brand?: string
  volumeMl?: number
  stock?: number
  pixDiscountPercent?: number
  status?: OrganizerStatus
}

// Card de produto clicavel usado nas grades e carrosseis: imagem, favoritar,
// nome, preco parcelado e botao de adicionar na sacola. Clicar no card leva
// para a pagina de detalhe do produto.
export function ItemCard({ className = '', item }: { className?: string; item: ItemCardContent }) {
  const { addItem } = useCart()
  const { token } = useAuth()
  // Estado local do coracao de favoritos (ainda nao persistido/sincronizado).
  const [favorited, setFavorited] = useState(false)
  const productName = item.name
  const productPrice = item.price || 0
  const displayPrice = productPrice
    ? productPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Preço não informado'
  const installmentPrice = productPrice / 12
  // Ajustes visuais/de texto conforme o status do item (ex: esgotado, em breve).
  const statusPresentation = getItemStatusPresentation(item.status)
  // So mostra "Ultimas X unidades" quando o status permite e ha estoque > 0.
  const showStockCount = statusPresentation.showStockCount && typeof item.stock === 'number' && item.stock > 0

  return (
    <Link
      to={`/produto/${item.id}`}
      onClick={() => trackProductEvent(item.id, 'click', token)}
      draggable={false}
      className={`flex h-full flex-col overflow-hidden rounded-[24px] border border-[#e3cfee] bg-white ${statusPresentation.grayscale ? 'grayscale' : ''} ${className}`}
    >
      <div className="relative flex aspect-[3/4] shrink-0 items-center justify-center bg-[color:var(--color-surface)] text-[color:var(--color-icon)]">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={productName}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package size={40} />
        )}
        {/* preventDefault/stopPropagation para o clique no coracao nao navegar
            para a pagina de detalhe (o card inteiro e um link). */}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setFavorited((value) => !value)
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={favorited ? 'Remover dos favoritos' : 'Favoritar'}
          aria-pressed={favorited}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center"
        >
          <img
            src={favorited ? itemIcons.coracaoPreenchido : itemIcons.coracaoContornado}
            alt=""
            className="h-6 w-6 object-contain"
          />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {item.tagLabel ? (
          <span className="inline-block w-fit rounded-[14px] bg-[#fff1d6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b77717]">
            {item.tagLabel}
          </span>
        ) : null}
        <p className="text-sm font-semibold text-[#2a0f3d]">{productName}</p>
        {item.description ? (
          <p className="line-clamp-2 text-xs leading-5 text-[#6b665f]">{item.description}</p>
        ) : null}
        {showStockCount ? (
          <p className="text-[11px] font-semibold text-[#a0382f]">Últimas {item.stock} unidades!</p>
        ) : null}
        {/* Preço e botão de comprar sempre no rodapé do card, mesmo quando a
            tag ou a descrição faltam - assim todo card fica do mesmo tamanho. */}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-sm font-semibold text-[#2a0f3d]">
              {statusPresentation.priceOverrideText ?? displayPrice}
            </p>
            {!statusPresentation.priceOverrideText && productPrice > 0 ? (
              <p className="mt-1 text-xs text-[#6b665f]">
                ou 12x de{' '}
                {installmentPrice.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            ) : null}
          </div>
          <div className="group relative">
            {/* Desativado quando o status do item troca o preco por um texto
                (ex: "Esgotado"), ja que nesse caso nao da para comprar. */}
            <button
              type="button"
              disabled={Boolean(statusPresentation.priceOverrideText)}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                addItem(itemCardToProduct(item))
              }}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label="Colocar na sacola"
              className="flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              <img src={itemIcons.compra} alt="" className="h-7 w-7 object-contain" />
            </button>
            <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-[8px] bg-[#2a0f3d] px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              Colocar na sacola
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
