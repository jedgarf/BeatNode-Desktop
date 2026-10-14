import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '../../shared/types'

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerState {
  library: Track[]
  queue: Track[]
  currentIndex: number
  history: number[]
  isPlaying: boolean
  isBuffering: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  // true while the volume mirrors the computer's master volume
  systemVolume: boolean
  repeat: RepeatMode
  shuffle: boolean
  // bumped on every track pick so the engine reloads even if the src is the same
  loadToken: number
  // seek target waiting for the engine to apply it
  pendingSeek: number | null

  addToLibrary: (tracks: Track[]) => void
  hydrateLibrary: (tracks: Track[]) => void
  removeFromLibrary: (trackId: string) => void
  setCover: (trackId: string, cover: string) => void
  playTrack: (trackId: string, context?: Track[]) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: (options?: { auto?: boolean }) => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  cycleRepeat: () => void
  toggleShuffle: () => void

  _setTime: (currentTime: number) => void
  _setDuration: (duration: number) => void
  _setBuffering: (isBuffering: boolean) => void
  _clearSeek: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
// past this many seconds, previous restarts the track instead of going back
const RESTART_THRESHOLD_SECONDS = 3

function randomIndexExcept(length: number, except: number): number {
  if (length <= 1) return 0
  let index = Math.floor(Math.random() * (length - 1))
  if (index >= except) index += 1
  return index
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      library: [],
      queue: [],
      currentIndex: -1,
      history: [],
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      muted: false,
      systemVolume: false,
      repeat: 'off',
      shuffle: false,
      loadToken: 0,
      pendingSeek: null,

      addToLibrary: (tracks) =>
        set((state) => {
          const known = new Set(state.library.map((t) => t.id))
          const fresh = tracks.filter((t) => !known.has(t.id))
          return fresh.length ? { library: [...state.library, ...fresh] } : state
        }),

      hydrateLibrary: (tracks) =>
        set((state) => {
          const restored = new Set(tracks.map((t) => t.id))
          return { library: [...tracks, ...state.library.filter((t) => !restored.has(t.id))] }
        }),

      setCover: (trackId, cover) =>
        set((state) => {
          const apply = (t: Track) => (t.id === trackId ? { ...t, cover } : t)
          return { library: state.library.map(apply), queue: state.queue.map(apply) }
        }),

      removeFromLibrary: (trackId) =>
        set((state) => {
          const removingCurrent = state.queue[state.currentIndex]?.id === trackId
          const library = state.library.filter((t) => t.id !== trackId)
          if (removingCurrent) {
            // current track is gone, stop
            return { library, queue: [], currentIndex: -1, history: [], isPlaying: false, currentTime: 0, duration: 0, loadToken: state.loadToken + 1 }
          }
          return { library }
        }),

      playTrack: (trackId, context) => {
        const queue = context ?? get().library
        const index = queue.findIndex((t) => t.id === trackId)
        if (index === -1) return
        set((state) => ({
          queue,
          currentIndex: index,
          history: [],
          isPlaying: true,
          currentTime: 0,
          duration: queue[index].duration,
          loadToken: state.loadToken + 1,
          pendingSeek: null,
        }))
      },

      play: () => {
        if (get().currentIndex !== -1) set({ isPlaying: true })
      },
      pause: () => set({ isPlaying: false }),
      togglePlay: () => {
        const { currentIndex, isPlaying, queue, library } = get()
        if (currentIndex === -1) {
          // nothing loaded, start from the top
          if (library.length) get().playTrack(library[0].id)
          return
        }
        set({ isPlaying: !isPlaying && queue.length > 0 })
      },

      next: ({ auto = false } = {}) => {
        const { queue, currentIndex, shuffle, repeat, history } = get()
        if (!queue.length || currentIndex === -1) return

        let target: number
        if (shuffle) {
          target = randomIndexExcept(queue.length, currentIndex)
        } else if (currentIndex + 1 < queue.length) {
          target = currentIndex + 1
        } else if (repeat === 'all') {
          target = 0
        } else {
          // end of queue: rewind on natural end, ignore manual skip
          if (auto) set({ isPlaying: false, currentTime: 0, pendingSeek: 0 })
          return
        }

        set((state) => ({
          currentIndex: target,
          history: [...history, currentIndex].slice(-100),
          isPlaying: true,
          currentTime: 0,
          duration: queue[target].duration,
          loadToken: state.loadToken + 1,
          pendingSeek: null,
        }))
      },

      previous: () => {
        const { queue, currentIndex, currentTime, history, repeat } = get()
        if (!queue.length || currentIndex === -1) return

        if (currentTime > RESTART_THRESHOLD_SECONDS) {
          set({ currentTime: 0, pendingSeek: 0 })
          return
        }

        let target: number
        if (history.length) {
          target = history[history.length - 1]
        } else if (currentIndex > 0) {
          target = currentIndex - 1
        } else if (repeat === 'all') {
          target = queue.length - 1
        } else {
          set({ currentTime: 0, pendingSeek: 0 })
          return
        }

        set((state) => ({
          currentIndex: target,
          history: history.slice(0, -1),
          isPlaying: true,
          currentTime: 0,
          duration: queue[target].duration,
          loadToken: state.loadToken + 1,
          pendingSeek: null,
        }))
      },

      seek: (seconds) => {
        const { duration, currentIndex } = get()
        if (currentIndex === -1) return
        const target = clamp(seconds, 0, duration || seconds)
        set({ currentTime: target, pendingSeek: target })
      },

      setVolume: (volume) => set({ volume: clamp(volume, 0, 1), muted: false }),
      toggleMute: () => set((state) => ({ muted: !state.muted })),
      cycleRepeat: () =>
        set((state) => ({ repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off' })),
      toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle, history: [] })),

      _setTime: (currentTime) => set({ currentTime }),
      _setDuration: (duration) => set({ duration }),
      _setBuffering: (isBuffering) => set({ isBuffering }),
      _clearSeek: () => set({ pendingSeek: null }),
    }),
    {
      name: 'beatnode-player',
      partialize: ({ volume, muted, repeat, shuffle }) => ({ volume, muted, repeat, shuffle }),
    },
  ),
)

export const selectCurrentTrack = (state: PlayerState): Track | null =>
  state.currentIndex === -1 ? null : (state.queue[state.currentIndex] ?? null)
