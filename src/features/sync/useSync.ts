import { useEffect } from 'react'
import { usePlaylistStore } from '../playlists/store'
import { mergePlaylists, samePlaylists } from './merge'
import { useSyncStore } from './store'

const PUSH_DEBOUNCE_MS = 1000

export function useSync(): void {
  const folder = useSyncStore((s) => s.folder)
  const ready = usePlaylistStore((s) => s.ready)

  useEffect(() => {
    window.beatnode.getSyncFolder().then(useSyncStore.getState().setFolder).catch(console.error)
  }, [])

  useEffect(() => {
    if (!folder || !ready) return

    let cancelled = false
    let running = false
    let queued = false
    let timer: number | undefined

    const run = async () => {
      if (running) {
        queued = true
        return
      }
      running = true
      const sync = useSyncStore.getState()
      sync.setSyncing()
      try {
        do {
          queued = false
          const remote = await window.beatnode.readSyncFile()
          if (cancelled) return
          const local = usePlaylistStore.getState().playlists
          const merged = mergePlaylists(local, remote?.playlists ?? [])
          if (!samePlaylists(merged, local)) usePlaylistStore.getState().setAll(merged)
          if (!remote || !samePlaylists(merged, remote.playlists)) {
            await window.beatnode.writeSyncFile({ version: 1, updatedAt: Date.now(), playlists: merged })
          }
        } while (queued)
        if (!cancelled) sync.setSynced()
      } catch (error) {
        console.error('[sync] failed:', error)
        if (!cancelled) sync.setError('Could not sync. Check that the folder is available.')
      } finally {
        running = false
      }
    }

    void run()
    const unsubscribeStore = usePlaylistStore.subscribe((state, prev) => {
      if (state.playlists === prev.playlists) return
      window.clearTimeout(timer)
      timer = window.setTimeout(run, PUSH_DEBOUNCE_MS)
    })
    const unsubscribeFile = window.beatnode.onSyncFileChange(run)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      unsubscribeStore()
      unsubscribeFile()
    }
  }, [folder, ready])
}
