import { create } from 'zustand'

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error'

interface SyncState {
  folder: string | null
  status: SyncStatus
  lastSyncedAt: number | null
  error: string | null
  setFolder: (folder: string | null) => void
  setSyncing: () => void
  setSynced: () => void
  setError: (message: string) => void
}

export const useSyncStore = create<SyncState>()((set) => ({
  folder: null,
  status: 'off',
  lastSyncedAt: null,
  error: null,
  setFolder: (folder) => set({ folder, status: folder ? 'syncing' : 'off', error: null }),
  setSyncing: () => set({ status: 'syncing', error: null }),
  setSynced: () => set({ status: 'synced', lastSyncedAt: Date.now(), error: null }),
  setError: (error) => set({ status: 'error', error }),
}))
