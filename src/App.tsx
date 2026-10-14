import { useState, type ComponentType } from 'react'
import { NowPlaying } from './components/layout/NowPlaying'
import { useAutoOpenForVideo } from './components/layout/useAutoOpenForVideo'
import { PlayerBar } from './components/layout/PlayerBar'
import { Sidebar, type ViewId } from './components/layout/Sidebar'
import { HomeView } from './features/library/HomeView'
import { LibraryView } from './features/library/LibraryView'
import { useArtwork } from './features/library/useArtwork'
import { usePersistence } from './features/library/usePersistence'
import { useAudioEngine } from './features/player/useAudioEngine'
import { useMediaSession } from './features/player/useMediaSession'
import { usePlayerBridge } from './features/player/usePlayerBridge'
import { usePlayerShortcuts } from './features/player/usePlayerShortcuts'
import { PlaylistsView } from './features/playlists/PlaylistsView'
import { SettingsView } from './features/settings/SettingsView'
import { useTheme } from './features/settings/theme'
import { useSync } from './features/sync/useSync'

const VIEWS: Record<ViewId, ComponentType> = {
  home: HomeView,
  library: LibraryView,
  playlists: PlaylistsView,
  settings: SettingsView,
}

export default function App() {
  const [view, setView] = useState<ViewId>('library')
  useTheme()
  usePersistence()
  useSync()
  useArtwork()
  useAutoOpenForVideo()
  useAudioEngine()
  useMediaSession()
  usePlayerBridge()
  usePlayerShortcuts()

  const View = VIEWS[view]

  return (
    <div className="flex h-full flex-col text-fg">
      <div className="flex min-h-0 flex-1">
        <Sidebar active={view} onNavigate={setView} />
        <div className="relative min-w-0 flex-1">
          <main className="h-full overflow-y-auto">
            <div className="drag-region sticky top-0 z-10 h-12 bg-gradient-to-b from-base/80 to-transparent" />
            <div key={view} className="-mt-12 animate-view-in px-8 pb-8 pt-16">
              <View />
            </div>
          </main>
          <NowPlaying />
        </div>
      </div>
      <PlayerBar />
    </div>
  )
}
