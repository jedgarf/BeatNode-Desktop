import { ipcRenderer, contextBridge } from 'electron'
import type { BeatNodeApi, LibraryChange, PlaybackReport, PlayerCommand } from '../src/shared/types'

// returns an unsubscribe fn
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

const beatnode: BeatNodeApi = {
  openAudioFiles: () => ipcRenderer.invoke('dialog:openAudioFile'),
  saveCover: (trackId, dataUrl) => ipcRenderer.invoke('covers:save', trackId, dataUrl),
  findCover: (filePath, artist, title) => ipcRenderer.invoke('covers:find', filePath, artist, title),
  getOnlineArtwork: () => ipcRenderer.invoke('onlineArtwork:get'),
  setOnlineArtwork: (enabled) => ipcRenderer.invoke('onlineArtwork:set', enabled),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  saveLibrary: (tracks) => ipcRenderer.invoke('library:save', tracks),
  loadPlaylists: () => ipcRenderer.invoke('playlists:load'),
  savePlaylists: (playlists) => ipcRenderer.invoke('playlists:save', playlists),

  reportPlayback: (report) => ipcRenderer.send('player:report', report),
  onPlayerCommand: (callback) => subscribe<PlayerCommand>('player:command', callback),
  onTrayState: (callback) => subscribe<PlaybackReport>('tray:state', callback),
  sendTrayCommand: (command) => ipcRenderer.send('tray:command', command),
  getBackgroundPlayback: () => ipcRenderer.invoke('background:get'),
  setBackgroundPlayback: (enabled) => ipcRenderer.invoke('background:set', enabled),
  getLyrics: (request) => ipcRenderer.invoke('lyrics:get', request),
  getOnlineLyrics: () => ipcRenderer.invoke('onlineLyrics:get'),
  setOnlineLyrics: (enabled) => ipcRenderer.invoke('onlineLyrics:set', enabled),
  getSession: () => ipcRenderer.invoke('session:get'),
  saveSession: (payload) => ipcRenderer.invoke('session:save', payload),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  getSystemVolume: () => ipcRenderer.invoke('systemVolume:get'),
  setSystemVolume: (patch) => ipcRenderer.invoke('systemVolume:set', patch),
  getLibraryPrefs: () => ipcRenderer.invoke('libraryPrefs:get'),
  setLibraryPrefs: (prefs) => ipcRenderer.invoke('libraryPrefs:set', prefs),

  getFolders: () => ipcRenderer.invoke('folders:get'),
  addFolders: () => ipcRenderer.invoke('folders:add'),
  removeFolder: (folder) => ipcRenderer.invoke('folders:remove', folder),
  startFolderWatch: () => ipcRenderer.invoke('folders:start'),
  rescanFolders: () => ipcRenderer.invoke('folders:rescan'),
  excludeFromLibrary: (filePath) => ipcRenderer.invoke('library:exclude', filePath),
  onLibraryChange: (callback) => subscribe<LibraryChange>('library:changed', callback),
  onScanState: (callback) => subscribe<boolean>('folders:scanning', callback),

  getSyncFolder: () => ipcRenderer.invoke('sync:get-folder'),
  chooseSyncFolder: () => ipcRenderer.invoke('sync:choose-folder'),
  disableSync: () => ipcRenderer.invoke('sync:disable'),
  readSyncFile: () => ipcRenderer.invoke('sync:read'),
  writeSyncFile: (file) => ipcRenderer.invoke('sync:write', file),
  onSyncFileChange: (callback) => subscribe<void>('sync:changed', callback),
}

contextBridge.exposeInMainWorld('beatnode', beatnode)
