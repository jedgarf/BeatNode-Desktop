import { useEffect, useRef, useState } from 'react'
import { useLibraryNoticeStore } from '../../features/library/libraryNotice'
import { CloseIcon, PlusIcon } from '../ui/icons'

const SHOW_MS = 6000
const LEAVE_MS = 260

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// slides in from the top when a watched folder gets new media, then goes away on its own
export function LibraryNotice() {
  const notice = useLibraryNoticeStore((s) => s.notice)
  const dismiss = useLibraryNoticeStore((s) => s.dismiss)
  const [leaving, setLeaving] = useState(false)
  // restarting the bar's key restarts its countdown to match the timer after a hover
  const [round, setRound] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const id = notice?.id

  const close = () => {
    window.clearTimeout(timer.current)
    setLeaving(true)
    timer.current = window.setTimeout(() => {
      dismiss()
      setLeaving(false)
    }, LEAVE_MS)
  }
  const arm = (ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(close, ms)
  }

  // a timer rather than a css animation end, reduced motion would cut an animation to nothing
  useEffect(() => {
    if (id === undefined) return
    setLeaving(false)
    arm(SHOW_MS)
    return () => window.clearTimeout(timer.current)
    // arm and close only touch refs and stable store actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!notice) return null

  const total = notice.songs + notice.videos
  const parts = [
    notice.songs > 0 ? plural(notice.songs, 'song', 'songs') : null,
    notice.videos > 0 ? plural(notice.videos, 'video', 'videos') : null,
  ].filter(Boolean)
  const headline = total === 1 ? notice.firstTitle : `${parts.join(' and ')} found`
  const detail =
    total === 1 ? `New ${notice.videos ? 'video' : 'song'} added${notice.firstArtist ? ` · ${notice.firstArtist}` : ''}` : 'New media added to your library'

  return (
    <div
      key={notice.id}
      role="status"
      aria-live="polite"
      onMouseEnter={() => window.clearTimeout(timer.current)}
      onMouseLeave={() => {
        setRound((r) => r + 1)
        arm(SHOW_MS)
      }}
      style={leaving ? { opacity: 0, transform: 'translateY(-16px) scale(0.96)', transition: `all ${LEAVE_MS}ms ease-in` } : undefined}
      className="no-drag group fixed inset-x-0 top-4 z-40 mx-auto w-[min(28rem,calc(100%-3rem))] animate-notice-in overflow-hidden rounded-2xl bg-elevated shadow-2xl shadow-black/50 ring-1 ring-fg/10"
    >
      <div className="flex items-center gap-3.5 p-3.5 pr-3">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent-soft">
          <span className="absolute inset-0 animate-notice-ring rounded-full ring-2 ring-accent/60" />
          <PlusIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={headline}>{headline}</p>
          <p className="truncate text-xs text-fg/55" title={detail}>{detail}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          title="Dismiss"
          className="shrink-0 rounded-full p-1.5 text-fg/50 transition hover:bg-fg/10 hover:text-fg"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <div key={round} className="h-0.5 origin-left animate-notice-progress bg-accent/70 group-hover:[animation-play-state:paused]" />
    </div>
  )
}
