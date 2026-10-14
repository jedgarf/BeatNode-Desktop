
export const AUDIO_EXTENSIONS = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'weba'] as const
// what chromium can decode (h264/aac mp4, vp8/vp9 webm), other codecs may not play.
// mkv is only the container: hevc and dts/ac3 inside it won't play
export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov', 'mkv', 'ogv'] as const

export type MediaKind = 'audio' | 'video'

export interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  kind: MediaKind
  duration: number
  cover: string | null
  src: string
  // artist|title|album hash, same song gets the same key on every device
  key: string
}

export interface PlaylistEntry {
  key: string
  title: string
  artist: string
}

export interface Playlist {
  id: string
  name: string
  entries: PlaylistEntry[]
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export interface LibraryChange {
  added: Track[]
  removedPaths: string[]
}

export interface SyncFile {
  version: 1
  updatedAt: number
  playlists: Playlist[]
}

export interface PlaybackReport {
  hasTrack: boolean
  title: string
  artist: string
  isPlaying: boolean
}

export type PlayerCommand = 'toggle' | 'next' | 'previous' | 'volumeUp' | 'volumeDown' | 'mute'
export type TrayCommand = 'toggle' | 'next' | 'previous' | 'show' | 'quit'

export type LibraryLayout = 'grid' | 'list'
export type LibraryFilter = 'all' | 'music' | 'videos'
export type LibrarySort = 'added' | 'title' | 'artist' | 'album' | 'duration'

export interface LibraryPrefs {
  layout: LibraryLayout
  filter: LibraryFilter
  sort: LibrarySort
}

export interface LyricLine {
  // seconds from the start
  time: number
  text: string
}

export interface LyricsRequest {
  path: string
  title: string
  artist: string
  album: string
  duration: number
}

export interface LyricsResult {
  // timed lines when we have them, plain text otherwise
  lines: LyricLine[] | null
  plain: string | null
  source: 'file' | 'embedded' | 'online'
}

export interface SessionState {
  trackId: string
  position: number
  queueIds: string[]
}

export interface SystemVolume {
  volume: number
  muted: boolean
}

export interface BeatNodeApi {
  openAudioFiles(): Promise<Track[]>
  saveCover(trackId: string, dataUrl: string): Promise<string | null>
  findCover(filePath: string, artist: string, title: string): Promise<string | null>
  getOnlineArtwork(): Promise<boolean>
  setOnlineArtwork(enabled: boolean): Promise<void>
  loadLibrary(): Promise<Track[]>
  saveLibrary(tracks: Track[]): Promise<void>
  loadPlaylists(): Promise<unknown[]>
  savePlaylists(playlists: Playlist[]): Promise<void>

  reportPlayback(report: PlaybackReport): void
  onPlayerCommand(callback: (command: PlayerCommand) => void): () => void
  onTrayState(callback: (report: PlaybackReport) => void): () => void
  sendTrayCommand(command: TrayCommand): void
  getBackgroundPlayback(): Promise<boolean>
  setBackgroundPlayback(enabled: boolean): Promise<void>
  getLyrics(request: LyricsRequest): Promise<LyricsResult | null>
  getOnlineLyrics(): Promise<boolean>
  setOnlineLyrics(enabled: boolean): Promise<void>
  getSession(): Promise<SessionState | null>
  saveSession(payload: { trackId: string; position: number; queueIds?: string[] }): Promise<void>
  clearSession(): Promise<void>
  getSystemVolume(): Promise<SystemVolume | null>
  setSystemVolume(patch: Partial<SystemVolume>): Promise<void>
  getLibraryPrefs(): Promise<LibraryPrefs>
  setLibraryPrefs(prefs: LibraryPrefs): Promise<void>

  getFolders(): Promise<string[]>
  addFolders(): Promise<string[]>
  removeFolder(folder: string): Promise<string[]>
  startFolderWatch(): Promise<void>
  rescanFolders(): Promise<void>
  excludeFromLibrary(filePath: string): Promise<void>
  onLibraryChange(callback: (change: LibraryChange) => void): () => void
  onScanState(callback: (scanning: boolean) => void): () => void

  getSyncFolder(): Promise<string | null>
  chooseSyncFolder(): Promise<string | null>
  disableSync(): Promise<void>
  readSyncFile(): Promise<SyncFile | null>
  writeSyncFile(file: SyncFile): Promise<void>
  onSyncFileChange(callback: () => void): () => void
}
