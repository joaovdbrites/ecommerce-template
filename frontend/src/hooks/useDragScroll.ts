import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export function useDragScroll<T extends HTMLElement>({ loopItemCount = 0 }: { loopItemCount?: number } = {}) {
  const ref = useRef<T>(null)
  const loopWidthRef = useRef(0)
  const loopItemCountRef = useRef(0)
  const dragState = useRef({ startX: 0, lastX: 0, moved: false, active: false })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || loopItemCount <= 0) {
      loopWidthRef.current = 0
      loopItemCountRef.current = 0
      return
    }

    const updateLoopWidth = () => {
      const children = Array.from(el.children) as HTMLElement[]
      const firstItem = children[0]
      const secondCopyStart = children[loopItemCount]
      const nextLoopWidth =
        firstItem && secondCopyStart ? secondCopyStart.offsetLeft - firstItem.offsetLeft : 0
      if (nextLoopWidth <= 0) return

      const previousLoopWidth = loopWidthRef.current
      const itemCountChanged = loopItemCountRef.current !== loopItemCount
      loopWidthRef.current = nextLoopWidth
      loopItemCountRef.current = loopItemCount

      if (previousLoopWidth <= 0 || itemCountChanged) {
        el.scrollLeft = nextLoopWidth
        return
      }

      if (previousLoopWidth !== nextLoopWidth) {
        const phase = (el.scrollLeft - previousLoopWidth) / previousLoopWidth
        el.scrollLeft = nextLoopWidth + Math.max(0, Math.min(1, phase)) * nextLoopWidth
      }
    }

    updateLoopWidth()
    const resizeObserver = new ResizeObserver(updateLoopWidth)
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [loopItemCount])

  const wrapScroll = () => {
    const el = ref.current
    const loopWidth = loopWidthRef.current
    if (!el || loopWidth <= 0) return
    if (el.scrollLeft >= loopWidth * 2) {
      el.scrollLeft -= loopWidth
    } else if (el.scrollLeft < loopWidth) {
      el.scrollLeft += loopWidth
    }
  }

  const onPointerDown = (event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (!el || event.pointerType === 'touch') return
    dragState.current = { startX: event.clientX, lastX: event.clientX, moved: false, active: true }
    setDragging(true)
  }

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (!el || !dragState.current.active) return
    const stepDelta = event.clientX - dragState.current.lastX
    dragState.current.lastX = event.clientX
    if (Math.abs(event.clientX - dragState.current.startX) > 3) {
      if (!dragState.current.moved) {
        event.preventDefault()
        // O ponteiro pode ja nao estar mais "ativo" aqui (ex.: um clique bem
        // rapido que solta antes do primeiro move cruzar o limiar de 3px) -
        // sem o capture o arrasto ainda funciona normalmente, so perde o
        // "continuar arrastando fora do elemento". Sem o try/catch, essa
        // excecao nao tratada travava o carrossel no meio do arrasto.
        try {
          el.setPointerCapture(event.pointerId)
        } catch {
          // ignorado de proposito, ver comentario acima
        }
      }
      dragState.current.moved = true
    }
    el.scrollLeft -= stepDelta
    wrapScroll()
  }

  const endDrag = (event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (el && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
    dragState.current.active = false
    setDragging(false)
  }

  return {
    ref,
    dragging,
    dragState,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onPointerCancel: endDrag,
      onScroll: wrapScroll,
    },
  }
}
