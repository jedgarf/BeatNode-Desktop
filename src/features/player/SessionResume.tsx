import { useEffect, useRef, useState } from 'react'
import { CoverArt } from '../../components/ui/CoverArt'
import { formatTime } from '../../shared/format'
import type { Track } from '../../shared/types'
import { selectCurrentTrack, usePlayerStore } from './store'

const SAVE_EVERY_MS = 5000

interface Resume {
  track: Track
  queue: Track[]
  position: number
}

// remembers what was playing, and on the next launch offers to pick it back up
export function SessionResume() {
  const [resume, setResume] = useState<Resume | null>(null)
  const libraryCount = usePlayerStore((s) => s.library.length)
  const checked = useRef(false)

  useEffect(() => {
    let lastQueue: Track[] | null = null
    let lastSaved = 0
    let timer: number | undefined

    const save = () => {
      const state = usePlayerStore.getState()
      const track = selectCurrentTrack(state)
      if (!track) return
      lastSaved = Date.now()
      const payload: { trackId: string; position: number; queueIds?: string[] } = { trackId: track.id, position: state.currentTime }
      if (state.queue !== lastQueue) {
        lastQueue = state.queue
        payload.queueIds = state.queue.map((t) => t.id)
      }
      window.beatnode.saveSession(payload).catch(console.error)
    }

    const unsubscribe = usePlayerStore.subscribe((state, prev) => {
      const changed = state.currentIndex !== prev.currentIndex || state.queue !== prev.queue || state.isPlaying !== prev.isPlaying
      if (changed) {
        window.clearTimeout(timer)
        timer = window.setTimeout(save, 300)
      } else if (state.isPlaying && Date.now() - lastSaved >= SAVE_EVERY_MS) {
        save()
      }
      // started something on their own, the offer no longer makes sense
      if (state.loadToken !== prev.loadToken) setResume(null)
    })

    // closing the window mid-song should still keep the exact spot
    window.addEventListener('beforeunload', save)
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
      window.removeEventListener('beforeunload', save)
    }
  }, [])

  // the library has to be loaded before the saved track can be matched
  useEffect(() => {
    if (checked.current || libraryCount === 0) return
    checked.current = true
    if (selectCurrentTrack(usePlayerStore.getState())) return
    window.beatnode
      .getSession()
      .then((session) => {
        if (!session || selectCurrentTrack(usePlayerStore.getState())) return
        const { library } = usePlayerStore.getState()
        const byId = new Map(library.map((t) => [t.id, t]))
        const track = byId.get(session.trackId)
        if (!track) return
        const queue = session.queueIds.map((id) => byId.get(id)).filter((t): t is Track => t !== undefined)
        setResume({ track, queue: queue.some((t) => t.id === track.id) ? queue : [track], position: session.position })
      })
      .catch(console.error)
  }, [libraryCount])

  if (!resume) return null

  const accept = () => {
    const { playTrack, seek } = usePlayerStore.getState()
    playTrack(resume.track.id, resume.queue)
    if (resume.position > 1) seek(resume.position)
    setResume(null)
  }
  const dismiss = () => {
    window.beatnode.clearSession().catch(console.error)
    setResume(null)
  }

  return (
    <div
      role="dialog"
      aria-label="Continue where you left off"
      className="fixed bottom-28 right-6 z-30 w-80 animate-fade-up rounded-2xl bg-elevated p-4 shadow-2xl shadow-black/50 ring-1 ring-fg/10"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg/50">Continue where you left off?</p>
      <div className="mb-4 flex items-center gap-3">
        <CoverArt track={resume.track} className="size-12 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={resume.track.title}>{resume.track.title}</p>
          <p className="truncate text-xs text-fg/50" title={resume.track.artist}>
            {resume.track.artist}{resume.position > 1 ? ` · at ${formatTime(resume.position)}` : ''}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={dismiss} className="rounded-full px-4 py-2 text-sm text-fg/70 ring-1 ring-fg/10 transition hover:text-fg">
          Dismiss
        </button>
        <button
          type="button"
          onClick={accept}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-glow transition hover:bg-accent-soft"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
