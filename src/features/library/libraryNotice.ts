import { create } from 'zustand'
import type { Track } from '../../shared/types'

export interface LibraryNotice {
  // changes on every push so the card replays its entrance and countdown
  id: number
  songs: number
  videos: number
  firstTitle: string
  firstArtist: string
}

interface NoticeState {
  notice: LibraryNotice | null
  announce: (found: Track[]) => void
  dismiss: () => void
}

let counter = 0

// folder scans found something new. only the notice changes, never playback
export const useLibraryNoticeStore = create<NoticeState>()((set, get) => ({
  notice: null,
  announce: (found) => {
    if (found.length === 0) return
    const videos = found.filter((t) => t.kind === 'video').length
    const current = get().notice
    // another batch while the card is still up adds to it instead of stacking
    set({
      notice: {
        id: ++counter,
        songs: (current?.songs ?? 0) + found.length - videos,
        videos: (current?.videos ?? 0) + videos,
        firstTitle: current?.firstTitle ?? found[0].title,
        firstArtist: current?.firstArtist ?? found[0].artist,
      },
    })
  },
  dismiss: () => set({ notice: null }),
}))
