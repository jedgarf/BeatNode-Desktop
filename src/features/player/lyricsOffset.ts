import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const OFFSET_STEP = 0.5
const OFFSET_LIMIT = 30

interface LyricsOffsetState {
  // seconds the lyrics run late for a track, negative when they should come sooner
  offsets: Record<string, number>
  nudge: (trackId: string, by: number) => void
  reset: (trackId: string) => void
}

export const useLyricsOffset = create<LyricsOffsetState>()(
  persist(
    (set) => ({
      offsets: {},
      nudge: (trackId, by) =>
        set((s) => {
          const next = Math.round(Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, (s.offsets[trackId] ?? 0) + by)) * 10) / 10
          const offsets = { ...s.offsets }
          if (next === 0) delete offsets[trackId]
          else offsets[trackId] = next
          return { offsets }
        }),
      reset: (trackId) =>
        set((s) => {
          const offsets = { ...s.offsets }
          delete offsets[trackId]
          return { offsets }
        }),
    }),
    { name: 'beatnode-lyrics-offset' },
  ),
)
