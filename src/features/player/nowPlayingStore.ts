import { create } from 'zustand'

interface NowPlayingState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useNowPlayingStore = create<NowPlayingState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
