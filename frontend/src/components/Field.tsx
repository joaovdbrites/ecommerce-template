import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// Label + dica opcional compartilhados pelos tres tipos de campo abaixo
// (input, select e textarea), para manter o mesmo estilo de rotulo.
function fieldWrapper(label: string, hint?: string) {
  return (
    <>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[#6b665f]">
        {label}
      </span>
      {hint ? <span className="mb-2 block text-xs text-[#8b847b]">{hint}</span> : null}
    </>
  )
}

// Campo de texto padrao de formulario, com label e dica.
export function InputField({
  label,
  hint,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}) {
  return (
    <label className="block">
      {fieldWrapper(label, hint)}
      <input className={['field-base', className].filter(Boolean).join(' ')} {...props} />
    </label>
  )
}

// Campo de selecao (dropdown) padrao de formulario, com label e dica.
export function SelectField({
  label,
  hint,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      {fieldWrapper(label, hint)}
      <select className={['field-base', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
    </label>
  )
}

// Campo de texto multilinha padrao de formulario, com label e dica.
export function TextAreaField({
  label,
  hint,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
}) {
  return (
    <label className="block">
      {fieldWrapper(label, hint)}
      <textarea
        className={['field-base min-h-28 rounded-[24px]', className].filter(Boolean).join(' ')}
        {...props}
      />
    </label>
  )
}
