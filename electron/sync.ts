import { createHash } from 'node:crypto'
import { watch, type FSWatcher } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dialog, ipcMain, type BrowserWindow } from 'electron'
import type { SyncFile } from '../src/shared/types'
import { sanitizePlaylists } from './playlists'
import { getSettings, updateSettings } from './settings'

const SYNC_FILE = 'beatnode-sync.json'
const WATCH_DEBOUNCE_MS = 600

let watcher: FSWatcher | null = null
let watchedFolder: string | null = null
let debounceTimer: NodeJS.Timeout | undefined
// hash of what we last wrote, so we ignore our own file changes
let lastWrittenHash: string | null = null

const hash = (text: string) => createHash('sha1').update(text).digest('hex')

// comes from a cloud folder, don't trust it
function sanitize(raw: unknown): SyncFile | null {
  if (typeof raw !== 'object' || raw === null) return null
  const file = raw as { version?: unknown; updatedAt?: unknown; playlists?: unknown }
  if (file.version !== 1 || !Array.isArray(file.playlists)) return null
  return {
    version: 1,
    updatedAt: typeof file.updatedAt === 'number' ? file.updatedAt : 0,
    playlists: sanitizePlaylists(file.playlists),
  }
}

function stopWatcher() {
  clearTimeout(debounceTimer)
  watcher?.close()
  watcher = null
  watchedFolder = null
}

function ensureWatcher(folder: string, getWindow: () => BrowserWindow | null) {
  if (watcher && watchedFolder === folder) return
  stopWatcher()
  try {
    watcher = watch(folder, { persistent: false }, (_event, filename) => {
      if (filename && filename !== SYNC_FILE) return
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        try {
          const current = hash(await readFile(path.join(folder, SYNC_FILE), 'utf8'))
          if (current === lastWrittenHash) return
        } catch {
          return // file mid-replace or removed; the next event will follow
        }
        getWindow()?.webContents.send('sync:changed')
      }, WATCH_DEBOUNCE_MS)
    })
    watcher.on('error', (error) => console.warn('[sync] watcher error:', error))
    watchedFolder = folder
  } catch (error) {
    console.warn(`[sync] cannot watch ${folder}:`, error)
  }
}

export function registerSyncIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('sync:get-folder', async () => {
    const { syncFolder } = await getSettings()
    if (syncFolder) ensureWatcher(syncFolder, getWindow)
    return syncFolder
  })

  ipcMain.handle('sync:choose-folder', async () => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Choose a folder to sync through',
      properties: ['openDirectory', 'createDirectory'],
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return (await getSettings()).syncFolder
    const folder = path.normalize(result.filePaths[0])
    await updateSettings({ syncFolder: folder })
    lastWrittenHash = null
    ensureWatcher(folder, getWindow)
    return folder
  })

  ipcMain.handle('sync:disable', async () => {
    stopWatcher()
    lastWrittenHash = null
    await updateSettings({ syncFolder: null })
  })

  ipcMain.handle('sync:read', async (): Promise<SyncFile | null> => {
    const { syncFolder } = await getSettings()
    if (!syncFolder) return null
    try {
      return sanitize(JSON.parse(await readFile(path.join(syncFolder, SYNC_FILE), 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[sync] read failed:', error)
      return null
    }
  })

  ipcMain.handle('sync:write', async (_event, raw: unknown) => {
    const { syncFolder } = await getSettings()
    const clean = sanitize(raw)
    if (!syncFolder || !clean) return
    const content = JSON.stringify(clean, null, 2)
    const target = path.join(syncFolder, SYNC_FILE)
    const temp = path.join(syncFolder, `.${SYNC_FILE}.tmp`)
    await mkdir(syncFolder, { recursive: true })
    lastWrittenHash = hash(content)
    await writeFile(temp, content, 'utf8')
    await rename(temp, target)
  })
}
