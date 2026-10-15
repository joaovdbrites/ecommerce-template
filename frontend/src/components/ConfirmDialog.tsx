import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

// Dialogo modal generico de confirmacao (ex: "excluir este item?"), com um
// botao de cancelar e outro de confirmar. So renderiza quando `open` e true.
export function ConfirmDialog({
  open,
  title,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative w-full max-w-md border border-stone-200 bg-white p-6 shadow-[var(--shadow-window)]"
        style={{ borderRadius: 'calc(var(--radius-window) * 1.33)' }}
      >
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-rose-50 p-3">
            <AlertTriangle size={20} className="text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#2a0f3d]">{title}</h3>
            <div className="mt-2 text-sm leading-6 text-[#6b665f]">{children}</div>
            <div className="mt-6 flex gap-3">
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
              <Button onClick={onConfirm} className="bg-rose-600 text-white hover:bg-rose-700">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
