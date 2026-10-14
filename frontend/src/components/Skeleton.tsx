export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={['skeleton-wave rounded-[22px]', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  )
}
