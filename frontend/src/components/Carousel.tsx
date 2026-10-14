import { useEffect, useState, type ReactNode } from 'react'
import { useDragScroll } from '../hooks/useDragScroll'

type CarouselProps<Item> = {
  ariaLabel: string
  className?: string
  fullBleed?: boolean | 'mobile'
  getItemKey: (item: Item, index: number) => string | number
  itemClassName?: string
  items: readonly Item[]
  loop?: boolean
  renderItem: (item: Item, index: number) => ReactNode
}

/**
 * Padrão de carrossel da loja: arraste horizontal, loop opcional e itens
 * duplicados inacessíveis para leitores de tela e navegação por teclado.
 */
export function Carousel<Item>({
  ariaLabel,
  className = '',
  fullBleed = true,
  getItemKey,
  itemClassName = '',
  items,
  loop = true,
  renderItem,
}: CarouselProps<Item>) {
  const [hasOverflow, setHasOverflow] = useState(false)
  const shouldLoop = loop && items.length > 0 && hasOverflow
  const { ref, dragging, handlers } = useDragScroll<HTMLDivElement>({
    loopItemCount: shouldLoop ? items.length : 0,
  })
  const renderedItems = shouldLoop ? [...items, ...items, ...items] : items
  const widthClassName =
    fullBleed === true
      ? 'left-1/2 w-[100dvw] max-w-[100dvw] -translate-x-1/2'
      : fullBleed === 'mobile'
        ? 'left-1/2 w-[100dvw] max-w-[100dvw] -translate-x-1/2 sm:left-0 sm:w-full sm:max-w-full sm:translate-x-0'
        : 'w-full max-w-full'

  useEffect(() => {
    const element = ref.current
    if (!element || items.length === 0) {
      setHasOverflow(false)
      return
    }

    const updateOverflow = () => {
      const children = Array.from(element.children).slice(0, items.length) as HTMLElement[]
      const firstItem = children[0]
      const lastItem = children.at(-1)
      if (!firstItem || !lastItem) {
        setHasOverflow(false)
        return
      }

      const styles = window.getComputedStyle(element)
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft || '0') + Number.parseFloat(styles.paddingRight || '0')
      const singleSetWidth =
        lastItem.offsetLeft + lastItem.offsetWidth - firstItem.offsetLeft + horizontalPadding
      setHasOverflow(singleSetWidth > element.clientWidth + 1)
    }

    updateOverflow()
    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(element)
    Array.from(element.children)
      .slice(0, items.length)
      .forEach((child) => resizeObserver.observe(child))
    return () => resizeObserver.disconnect()
  }, [items, ref])

  return (
    <div
      ref={ref}
      {...handlers}
      role="region"
      aria-label={ariaLabel}
      className={[
        'relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        widthClassName,
        dragging ? 'cursor-grabbing select-none' : 'cursor-grab',
        className,
      ].join(' ')}
    >
      {renderedItems.map((item, index) => {
        const duplicate = shouldLoop && (index < items.length || index >= items.length * 2)
        return (
          <div
            key={`${getItemKey(item, index % items.length)}-${index}`}
            aria-hidden={duplicate || undefined}
            inert={duplicate || undefined}
            className={itemClassName}
          >
            {renderItem(item, index % items.length)}
          </div>
        )
      })}
    </div>
  )
}
