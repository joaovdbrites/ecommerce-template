import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

// Habilita arrastar-para-rolar (clique e arraste com mouse) em um container
// horizontal, com suporte opcional a um carrossel "infinito": quando
// `loopItemCount` > 0, o conteudo e tratado como tendo copias repetidas dos
// primeiros itens no final, e o scroll "teleporta" de volta ao meio sempre
// que o usuario chega perto de uma ponta - dando a ilusao de loop sem fim.
export function useDragScroll<T extends HTMLElement>({ loopItemCount = 0 }: { loopItemCount?: number } = {}) {
  const ref = useRef<T>(null)
  // Largura (em px) de "uma volta" do loop, isto e, a distancia entre o
  // inicio da primeira copia dos itens e o inicio da segunda copia.
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

    // Recalcula a largura de uma volta do loop a partir da posicao real dos
    // elementos filhos (a copia que comeca no indice `loopItemCount` marca o
    // fim da primeira volta), e recoloca o scroll em um ponto equivalente
    // sempre que essa largura mudar - ex.: apos resize ou troca de itens.
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

      // Primeira medicao (ou mudou a quantidade de itens do loop): comeca
      // posicionado no inicio da segunda volta, pra sobrar espaco pra
      // arrastar tanto pra tras quanto pra frente desde o inicio.
      if (previousLoopWidth <= 0 || itemCountChanged) {
        el.scrollLeft = nextLoopWidth
        return
      }

      // A largura mudou (ex.: itens com tamanho responsivo) - converte a
      // posicao atual em uma fase relativa (0 a 1) dentro da volta antiga e
      // aplica essa mesma fase na nova largura, pra nao "pular" visualmente.
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

  // Quando o scroll sai da faixa central (volta 1 a 2), reposiciona de volta
  // pra faixa equivalente na volta vizinha - e o "teleporte" que faz o loop
  // parecer infinito sem nunca deixar o usuario ver a borda real do conteudo.
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

  // Inicia o arrasto com o botao do mouse. Ignora toque porque o touch ja
  // tem scroll nativo por gesto - capturar aqui so atrapalharia.
  const onPointerDown = (event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (!el || event.pointerType === 'touch') return
    dragState.current = { startX: event.clientX, lastX: event.clientX, moved: false, active: true }
    setDragging(true)
  }

  // Durante o arrasto, move o scroll pelo delta do ponteiro e reaplica o
  // wrap do loop a cada passo (senao um arrasto rapido poderia ultrapassar o
  // ponto de teleporte sem ser corrigido).
  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (!el || !dragState.current.active) return
    const stepDelta = event.clientX - dragState.current.lastX
    dragState.current.lastX = event.clientX
    // So considera "arrastou de verdade" depois de passar um limiar de 3px -
    // evita que um clique simples (ex. em um item do carrossel) seja tratado
    // como arrasto e acabe bloqueando o click do usuario.
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

  // Encerra o arrasto (soltar, sair do elemento ou cancelamento do
  // ponteiro), liberando a captura se ela tiver sido feita.
  const endDrag = (event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (el && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
    dragState.current.active = false
    setDragging(false)
  }

  // Expoe o ref para o elemento rolavel, o estado "esta arrastando" (pra
  // estilizar o cursor, por ex.) e os handlers de ponteiro prontos para
  // espalhar no elemento alvo.
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
