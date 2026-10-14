import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  showLyrics: boolean
  toggleLyrics: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      showLyrics: true,
      toggleLyrics: () => set((s) => ({ showLyrics: !s.showLyrics })),
    }),
    { name: 'beatnode-ui' },
  ),
)
