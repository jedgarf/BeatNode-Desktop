import type { ReactNode } from 'react'

interface PageTitleProps {
  icon: ReactNode
  children: ReactNode
  className?: string
  compact?: boolean
}

// the icon is sized in css so it can ease along with the text when the title shrinks
export function PageTitle({ icon, children, className = '', compact = false }: PageTitleProps) {
  const ease = 'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
  return (
    <h1 className={`flex items-center font-bold tracking-tight ${ease} ${compact ? 'gap-2.5 text-xl' : 'gap-3.5 text-3xl'} ${className}`}>
      <span
        className={`flex shrink-0 text-accent-soft drop-shadow-[0_0_10px_var(--c-glow)] ${ease} [&>svg]:transition-all [&>svg]:duration-300 ${
          compact ? '[&>svg]:size-[22px]' : '[&>svg]:size-8'
        }`}
      >
        {icon}
      </span>
      {children}
    </h1>
  )
}
