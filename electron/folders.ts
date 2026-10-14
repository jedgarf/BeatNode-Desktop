import { watch, type FSWatcher } from 'node:fs'
import { readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { dialog, ipcMain, type BrowserWindow } from 'electron'
import type { LibraryChange } from '../src/shared/types'
import { isGranted, isSupportedMedia, readTrack, revokePath } from './library'
import { getSettings, updateSettings } from './settings'

const SCAN_DEBOUNCE_MS = 1000
const READ_CONCURRENCY = 6

interface FolderState {
  watcher: FSWatcher | null
  // files from the last scan, null until the first one
  known: Set<string> | null
  timer?: NodeJS.Timeout
  running: boolean
  queued: boolean
}

const folders = new Map<string, FolderState>()
let activeScans = 0
let getWindow: () => BrowserWindow | null = () => null

const send = (channel: string, payload: unknown) => getWindow()?.webContents.send(channel, payload)

function beginScan() {
  if (activeScans++ === 0) send('folders:scanning', true)
}
function endScan() {
  if (--activeScans === 0) send('folders:scanning', false)
}

const IGNORED_DIR_NAMES = new Set(['node_modules', '__pycache__', '$RECYCLE.BIN', 'System Volume Information'])
// app data in the home folder, music is not kept there and it is full of caches and sdk sounds
const IGNORED_HOME_DIRS = new Set(['Library', 'AppData'])
const BUNDLE_EXTENSIONS = new Set(['.app', '.framework', '.bundle', '.photoslibrary'])

function isIgnoredDir(dir: string): boolean {
  const name = path.basename(dir)
  if (IGNORED_DIR_NAMES.has(name) || BUNDLE_EXTENSIONS.has(path.extname(name).toLowerCase())) return true
  return IGNORED_HOME_DIRS.has(name) && path.dirname(dir) === os.homedir()
}

// true when the file sits under a directory the scan skips, relative to the watched folder
export function isIgnoredPath(root: string, filePath: string): boolean {
  const relative = path.relative(root, path.dirname(filePath))
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false
  let dir = root
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    dir = path.join(dir, segment)
    if (isIgnoredDir(dir)) return true
  }
  return false
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!isIgnoredDir(full)) await walk(full, out)
    }
    else if (entry.isFile() && isSupportedMedia(full)) out.push(path.normalize(full))
  }
  return out
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function scan(folder: string): Promise<void> {
  const state = folders.get(folder)
  if (!state) return
  if (state.running) {
    state.queued = true
    return
  }
  state.running = true
  beginScan()
  try {
    do {
      state.queued = false
      // drive unplugged? don't treat that as everything being deleted
      try {
        await readdir(folder)
      } catch {
        console.warn(`[folders] ${folder} is unreachable, skipping scan`)
        break
      }
      const files = await walk(folder)
      const present = new Set(files)
      const excluded = new Set((await getSettings()).excluded)
      const fresh = files.filter((f) => !excluded.has(f) && !isGranted(f))
      const removedPaths = state.known ? [...state.known].filter((p) => !present.has(p)) : []
      state.known = present
      removedPaths.forEach(revokePath)
      const added = await mapLimit(fresh, READ_CONCURRENCY, readTrack)
      if (added.length || removedPaths.length) {
        const change: LibraryChange = { added, removedPaths }
        send('library:changed', change)
      }
    } while (state.queued)
  } catch (error) {
    console.error(`[folders] scan of ${folder} failed:`, error)
  } finally {
    state.running = false
    endScan()
  }
}

function scheduleScan(folder: string) {
  const state = folders.get(folder)
  if (!state) return
  clearTimeout(state.timer)
  state.timer = setTimeout(() => void scan(folder), SCAN_DEBOUNCE_MS)
}

function startWatching(folder: string): Promise<void> {
  let state = folders.get(folder)
  if (!state) {
    state = { watcher: null, known: null, running: false, queued: false }
    folders.set(folder, state)
  }
  if (!state.watcher) {
    try {
      state.watcher = watch(folder, { recursive: true, persistent: false }, (_event, filename) => {
        // a busy folder like home fires constantly, only media files and directories matter
        if (filename) {
          const name = filename.toString()
          const ext = path.extname(name)
          if (ext !== '' && !isSupportedMedia(name)) return
          if (isIgnoredPath(folder, path.join(folder, name))) return
        }
        scheduleScan(folder)
      })
      state.watcher.on('error', (error) => console.warn(`[folders] watcher error for ${folder}:`, error))
    } catch (error) {
      console.warn(`[folders] cannot watch ${folder}; use "Rescan" instead:`, error)
    }
  }
  return scan(folder)
}

function stopWatching(folder: string) {
  const state = folders.get(folder)
  if (!state) return
  clearTimeout(state.timer)
  state.watcher?.close()
  folders.delete(folder)
}

export async function unexclude(paths: string[]): Promise<void> {
  const { excluded } = await getSettings()
  const drop = new Set(paths.map((p) => path.normalize(p)))
  if (excluded.some((p) => drop.has(p))) await updateSettings({ excluded: excluded.filter((p) => !drop.has(p)) })
}

export function registerFolderIpc(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter

  ipcMain.handle('folders:get', async () => (await getSettings()).folders)

  ipcMain.handle('folders:start', async () => {
    const { folders: saved } = await getSettings()
    void Promise.all(saved.map(startWatching))
  })

  ipcMain.handle('folders:add', async () => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Add music folder',
      properties: ['openDirectory', 'multiSelections'],
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    const { folders: saved } = await getSettings()
    if (result.canceled) return saved
    const picked = result.filePaths.map((f) => path.normalize(f)).filter((f) => !saved.includes(f))
    const next = [...saved, ...picked]
    await updateSettings({ folders: next })
    void Promise.all(picked.map(startWatching))
    return next
  })

  ipcMain.handle('folders:remove', async (_event, folder: unknown) => {
    const { folders: saved } = await getSettings()
    if (typeof folder !== 'string') return saved
    stopWatching(folder)
    const next = saved.filter((f) => f !== folder)
    await updateSettings({ folders: next })
    return next
  })

  // progress shows through folders:scanning, so don't hold the button for a long walk
  ipcMain.handle('folders:rescan', () => {
    for (const folder of folders.keys()) void scan(folder)
  })

  ipcMain.handle('library:exclude', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') return
    const normalized = path.normalize(filePath)
    const { excluded } = await getSettings()
    if (!excluded.includes(normalized)) await updateSettings({ excluded: [...excluded, normalized] })
  })
}
