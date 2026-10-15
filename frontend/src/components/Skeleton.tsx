// Placeholder animado (efeito de onda) exibido no lugar de conteudo que ainda
// esta carregando, como imagens ou textos de um card.
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={['skeleton-wave rounded-[22px]', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  )
}
