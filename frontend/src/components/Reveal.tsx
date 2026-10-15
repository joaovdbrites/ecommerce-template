import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

// Envolve o conteudo e aplica uma animacao de entrada (fade/slide) quando ele
// entra na area visivel da tela, usado para dar vida a secoes ao rolar a pagina.
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Controla se a classe de "revelado" ja foi aplicada.
  const [visible, setVisible] = useState(false)

  // Observa quando o elemento entra na tela e dispara a revelacao uma unica
  // vez, desconectando o observer em seguida (nao precisa animar de novo).
  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.12 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
