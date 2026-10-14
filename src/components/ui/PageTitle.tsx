import type { ReactNode } from 'react'

// the rounded tile that holds a page icon, shared with the animated greeting
export function TitleTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent-soft ring-1 ring-accent/20">
      {children}
    </span>
  )
}

export function PageTitle({ icon, children, className = '' }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <h1 className={`flex items-center gap-3.5 text-3xl font-bold tracking-tight ${className}`}>
      <TitleTile>{icon}</TitleTile>
      {children}
    </h1>
  )
}
