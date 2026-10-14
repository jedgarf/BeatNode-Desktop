import { ipcMain } from 'electron'
import type { SessionState } from '../src/shared/types'
import { deleteKv, getKv, putKv } from './db'

const POSITION_KEY = 'sessionPosition'
const QUEUE_KEY = 'sessionQueue'
// ids are 16 hex characters, and a library is never this big
const MAX_QUEUE = 20000

const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{16}$/.test(v)

export function registerSessionIpc(): void {
  ipcMain.handle('session:get', (): SessionState | null => {
    const saved = getKv<{ trackId?: unknown; position?: unknown } | null>(POSITION_KEY, null)
    if (!saved || !isId(saved.trackId)) return null
    const queue = getKv<unknown>(QUEUE_KEY, [])
    return {
      trackId: saved.trackId,
      position: typeof saved.position === 'number' && saved.position > 0 ? saved.position : 0,
      queueIds: Array.isArray(queue) ? queue.filter(isId) : [],
    }
  })

  // the queue is only sent when it changed, the position goes out every few seconds
  ipcMain.handle('session:save', (_event, raw: unknown) => {
    const payload = (typeof raw === 'object' && raw !== null ? raw : {}) as { trackId?: unknown; position?: unknown; queueIds?: unknown }
    if (!isId(payload.trackId)) return
    const position = typeof payload.position === 'number' && Number.isFinite(payload.position) ? Math.max(0, payload.position) : 0
    putKv(POSITION_KEY, { trackId: payload.trackId, position })
    if (Array.isArray(payload.queueIds)) putKv(QUEUE_KEY, payload.queueIds.filter(isId).slice(0, MAX_QUEUE))
  })

  ipcMain.handle('session:clear', () => {
    deleteKv(POSITION_KEY)
    deleteKv(QUEUE_KEY)
  })
}
