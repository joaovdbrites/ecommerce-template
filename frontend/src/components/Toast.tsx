import { CheckCircle, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'

type ToastTone = 'success' | 'error'

export function Toast({
  message,
  tone = 'success',
  onClose,
}: {
  message: string
  tone?: ToastTone
  onClose: () => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4000)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div
        className={[
          'flex items-center gap-3 rounded-[20px] border px-5 py-4 shadow-lg backdrop-blur',
          tone === 'success'
            ? 'border-[#bde4d4] bg-[#eefaf5]/95 text-[#0f8a5f]'
            : 'border-rose-200 bg-rose-50/95 text-rose-700',
        ].join(' ')}
      >
        {tone === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 rounded-[20px] p-1 hover:bg-black/5">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
