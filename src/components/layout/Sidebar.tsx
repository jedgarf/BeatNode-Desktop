import type { ReactNode } from 'react'
import { useUiStore } from '../../features/settings/uiStore'
import { CollapseIcon, ExpandIcon, HomeIcon, LibraryIcon, PlaylistsIcon, SettingsIcon } from '../ui/icons'
import { Logo, LogoMark } from '../ui/Logo'

export type ViewId = 'home' | 'library' | 'playlists' | 'settings'

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: ReactNode }> = [
  { id: 'home', label: 'Home', icon: <HomeIcon size={20} /> },
  { id: 'library', label: 'Library', icon: <LibraryIcon size={20} /> },
  { id: 'playlists', label: 'Playlists', icon: <PlaylistsIcon size={20} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
]

interface SidebarProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

// open it shows words, collapsed it shows icons so it still fits a narrow window
export function Sidebar({ active, onNavigate }: SidebarProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-fg/5 bg-surface/60 backdrop-blur-xl transition-[width] duration-200 ${collapsed ? 'w-[4.5rem]' : 'w-56'}`}
    >
      <div className="drag-region h-12 shrink-0" />
      <div className={`pb-6 ${collapsed ? 'flex justify-center' : 'px-5'}`}>
        {collapsed ? <LogoMark size={32} /> : <Logo />}
      </div>
      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              title={label}
              className={`relative rounded-xl py-2.5 text-sm font-medium transition ${collapsed ? 'flex justify-center px-0' : 'px-4 text-left'} ${isActive ? 'bg-fg/10 text-fg' : 'text-fg/55 hover:bg-fg/5 hover:text-fg'}`}
            >
              <span
                className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
              />
              {collapsed ? icon : label}
            </button>
          )
        })}
      </nav>
      <div className={`mt-auto flex px-3 pb-4 ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="rounded-full p-2 text-fg/50 transition hover:bg-fg/10 hover:text-fg"
        >
          {collapsed ? <ExpandIcon size={18} /> : <CollapseIcon size={18} />}
        </button>
      </div>
    </aside>
  )
}
