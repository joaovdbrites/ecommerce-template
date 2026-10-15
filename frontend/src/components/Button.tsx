/* eslint-disable react-refresh/only-export-components */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

// Classes de cor/fundo para cada variacao visual do botao.
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-dark)_100%)] text-white shadow-[0_24px_48px_-26px_color-mix(in_srgb,var(--color-primary)_70%,black)] hover:brightness-90 disabled:bg-stone-300 disabled:text-stone-500',
  secondary:
    'border border-[#ddc7ea] bg-white text-[#2a0f3d] hover:bg-[#f3e9f7] disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400',
  ghost: 'bg-transparent text-[#2a0f3d] hover:bg-black/5 disabled:text-stone-400',
}

// Classes de espacamento/tamanho de fonte para cada tamanho do botao.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2.5 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-4 text-base',
}

// Monta a string de classes do botao a partir de variante/tamanho/largura,
// reaproveitada tanto pelo componente Button quanto por outros elementos
// (links, labels) que precisam parecer um botao sem ser um <button>.
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold transition duration-300 disabled:cursor-not-allowed disabled:shadow-none',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

// Botao padrao da loja: aplica variante/tamanho via buttonClassName e repassa
// os demais props HTML (onClick, disabled, etc.) direto para o <button>.
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}) {
  return (
    <button type={type} className={buttonClassName({ variant, size, fullWidth, className })} {...props}>
      {children}
    </button>
  )
}
