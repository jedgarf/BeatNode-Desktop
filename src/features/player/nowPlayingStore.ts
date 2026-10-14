import { create } from 'zustand'
import { selectCurrentTrack, usePlayerStore } from './store'

interface NowPlayingState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

// a video with its picture closed shouldn't keep playing, so closing it pauses
function pauseIfVideo() {
  const player = usePlayerStore.getState()
  if (selectCurrentTrack(player)?.kind === 'video') player.pause()
}

export const useNowPlayingStore = create<NowPlayingState>()((set, get) => ({
  open: false,
  setOpen: (open) => {
    if (!open && get().open) pauseIfVideo()
    set({ open })
  },
  toggle: () => get().setOpen(!get().open),
}))
