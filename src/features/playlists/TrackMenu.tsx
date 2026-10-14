import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Track } from '../../shared/types'
import { usePlayerStore } from '../player/store'
import { entryFromTrack, usePlaylistStore } from './store'
import { useLivePlaylists } from './useLivePlaylists'

interface TrackMenuProps {
  track: Track
  playlistId?: string
  className?: string
}

export function TrackMenu({ track, playlistId, className = '' }: TrackMenuProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const playlists = useLivePlaylists()
  const { addTrack, create, removeTrack } = usePlaylistStore.getState()

  function close() {
    setOpen(false)
    setName('')
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // opens below the button, flips up when it would run off the window
  useLayoutEffect(() => {
    if (!open) return setPosition({ visibility: 'hidden' })
    const button = rootRef.current?.getBoundingClientRect()
    const menu = menuRef.current?.getBoundingClientRect()
    if (!button || !menu) return
    const gap = 6
    const below = button.bottom + gap
    const top = below + menu.height > window.innerHeight - 8 ? Math.max(8, button.top - gap - menu.height) : below
    const left = Math.min(Math.max(8, button.right - menu.width), window.innerWidth - menu.width - 8)
    setPosition({ top, left })
  }, [open])

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    create(name, [entryFromTrack(track)])
    close()
  }

  const item = 'block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-fg/80 transition hover:bg-fg/10 hover:text-fg'

  return (
    <div ref={rootRef} className={`relative ${className} ${open ? 'opacity-100!' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`rounded-full px-3 py-1.5 text-xs text-fg/60 transition hover:bg-fg/10 hover:text-fg ${open ? 'bg-fg/10' : ''}`}
      >
        More
      </button>
      {open &&
        createPortal(
          <div ref={menuRef} role="menu" style={position} className="fixed z-50 w-60 animate-fade-up rounded-xl border border-fg/10 bg-elevated/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wider text-fg/40">Add to playlist</p>
            <div className="max-h-48 overflow-y-auto">
              {playlists.map((p) => {
                const already = p.entries.some((e) => e.key === track.key)
                return (
                  <button
                    key={p.id}
                    role="menuitem"
                    type="button"
                    disabled={already}
                    onClick={() => { addTrack(p.id, track); close() }}
                    className={`${item} disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent`}
                  >
                    {p.name}{already ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>
            <form onSubmit={onCreate} className="mt-1 flex gap-1.5 border-t border-fg/10 p-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New playlist…"
                maxLength={60}
                className="min-w-0 flex-1 rounded-lg bg-fg/10 px-2.5 py-1.5 text-sm text-fg outline-none placeholder:text-fg/30 focus:ring-1 focus:ring-accent-soft"
              />
              <button type="submit" disabled={!name.trim()} className="rounded-lg bg-accent px-2.5 text-sm font-semibold text-white disabled:opacity-40">Add</button>
            </form>
            <div className="mt-1 border-t border-fg/10 pt-1">
              {playlistId && (
                <button role="menuitem" type="button" onClick={() => { removeTrack(playlistId, track.key); close() }} className={item}>
                  Remove from this playlist
                </button>
              )}
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  usePlayerStore.getState().removeFromLibrary(track.id)
                  void window.beatnode.excludeFromLibrary(track.path)
                  close()
                }}
                className={`${item} text-red-300 hover:text-red-200`}
              >
                Remove from library
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
