import { useEffect } from 'react'
import { usePlayerStore } from '../player/store'
import { useLibraryNoticeStore } from './libraryNotice'
import { usePlaylistStore } from '../playlists/store'

const SAVE_DEBOUNCE_MS = 300

export function usePersistence(): void {
  useEffect(() => {
    let hydrated = false
    let cancelled = false
    let libraryTimer: number | undefined
    let playlistTimer: number | undefined

    const saveLibrary = () => window.beatnode.saveLibrary(usePlayerStore.getState().library).catch(logSaveError)
    const savePlaylists = () => window.beatnode.savePlaylists(usePlaylistStore.getState().playlists).catch(logSaveError)

    Promise.all([window.beatnode.loadLibrary(), window.beatnode.loadPlaylists()])
      .then(([tracks, playlists]) => {
        if (cancelled) return
        // flag first so the merged result gets saved back (prunes missing files too)
        hydrated = true
        usePlayerStore.getState().hydrateLibrary(tracks)
        usePlaylistStore.getState().hydrate(playlists, usePlayerStore.getState().library)
        // library is in, folder scan can diff against it now
        void window.beatnode.startFolderWatch()
      })
      .catch((error) => console.error('[persistence] load failed:', error))

    const unsubFolderChanges = window.beatnode.onLibraryChange(({ added, removedPaths }) => {
      const player = usePlayerStore.getState()
      // only what really got in: duplicates and already known files are dropped by the store
      const known = new Set(player.library.map((t) => t.id))
      player.addToLibrary(added)
      const inLibrary = new Set(usePlayerStore.getState().library.map((t) => t.id))
      useLibraryNoticeStore.getState().announce(added.filter((t) => !known.has(t.id) && inLibrary.has(t.id)))
      if (removedPaths.length) {
        const gone = new Set(removedPaths)
        player.library.filter((t) => gone.has(t.path)).forEach((t) => player.removeFromLibrary(t.id))
      }
    })

    const unsubLibrary = usePlayerStore.subscribe((state, prev) => {
      if (!hydrated || state.library === prev.library) return
      window.clearTimeout(libraryTimer)
      libraryTimer = window.setTimeout(saveLibrary, SAVE_DEBOUNCE_MS)
    })
    const unsubPlaylists = usePlaylistStore.subscribe((state, prev) => {
      if (!hydrated || state.playlists === prev.playlists) return
      window.clearTimeout(playlistTimer)
      playlistTimer = window.setTimeout(savePlaylists, SAVE_DEBOUNCE_MS)
    })

    return () => {
      cancelled = true
      unsubFolderChanges()
      unsubLibrary()
      unsubPlaylists()
      window.clearTimeout(libraryTimer)
      window.clearTimeout(playlistTimer)
    }
  }, [])
}

function logSaveError(error: unknown) {
  console.error('[persistence] save failed:', error)
}
