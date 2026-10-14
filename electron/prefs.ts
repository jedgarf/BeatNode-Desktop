import { ipcMain } from 'electron'
import type { LibraryFilter, LibraryLayout, LibraryPrefs, LibrarySort } from '../src/shared/types'
import { getKv, putKv } from './db'

const KEY = 'libraryPrefs'
const LAYOUTS: LibraryLayout[] = ['grid', 'list']
const FILTERS: LibraryFilter[] = ['all', 'music', 'videos']
const SORTS: LibrarySort[] = ['added', 'title', 'artist', 'album', 'duration']

const DEFAULTS: LibraryPrefs = { layout: 'grid', filter: 'all', sort: 'added' }

function pick<T extends string>(allowed: T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function sanitize(raw: unknown): LibraryPrefs {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    layout: pick(LAYOUTS, r.layout, DEFAULTS.layout),
    filter: pick(FILTERS, r.filter, DEFAULTS.filter),
    sort: pick(SORTS, r.sort, DEFAULTS.sort),
  }
}

export function registerPrefsIpc(): void {
  ipcMain.handle('libraryPrefs:get', () => sanitize(getKv<unknown>(KEY, null)))
  ipcMain.handle('libraryPrefs:set', (_event, prefs: unknown) => {
    putKv(KEY, sanitize(prefs))
  })
}
