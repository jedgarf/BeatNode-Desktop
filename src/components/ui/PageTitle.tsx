import type { ReactNode } from 'react'

export function PageTitle({ icon, children, className = '' }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <h1 className={`flex items-center gap-3.5 text-3xl font-bold tracking-tight ${className}`}>
      <span className="flex shrink-0 text-accent-soft drop-shadow-[0_0_10px_var(--c-glow)]">{icon}</span>
      {children}
    </h1>
  )
}
