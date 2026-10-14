import { Logo } from '../ui/Logo'

export type ViewId = 'home' | 'library' | 'playlists' | 'settings'

const NAV_ITEMS: Array<{ id: ViewId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'library', label: 'Library' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'settings', label: 'Settings' },
]

interface SidebarProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-fg/5 bg-surface/60 backdrop-blur-xl">
      <div className="drag-region h-12 shrink-0" />
      <div className="px-5 pb-6">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ id, label }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative rounded-xl px-4 py-2.5 text-left text-sm font-medium transition ${isActive ? 'bg-fg/10 text-fg' : 'text-fg/55 hover:bg-fg/5 hover:text-fg'}`}
            >
              <span
                className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
              />
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
