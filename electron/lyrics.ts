import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, ipcMain, net } from 'electron'
import { TimestampFormat, parseFile } from 'music-metadata'
import type { LyricLine, LyricsRequest, LyricsResult } from '../src/shared/types'
import { getKv, putKv } from './db'
import { isGranted, trackId } from './library'

const ONLINE_KEY = 'onlineLyrics'
const MISS_RETRY_MS = 7 * 24 * 60 * 60 * 1000
const REQUEST_GAP_MS = 1000
const REQUEST_TIMEOUT_MS = 8000
const MAX_TEXT = 200

const lyricsDir = () => path.join(app.getPath('userData'), 'lyrics')

// [mm:ss.xx] stamps, a line can carry several. metadata tags like [ar:...] have no digits and are skipped
export function parseLrc(source: string): LyricsResult | null {
  const stamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g
  const offset = /\[offset:\s*(-?\d+)\s*\]/i.exec(source)
  const shift = offset ? Number(offset[1]) / 1000 : 0
  const lines: LyricLine[] = []
  const plain: string[] = []

  for (const raw of source.split(/\r?\n/)) {
    const times: number[] = []
    const text = raw
      .replace(stamp, (_match, min: string, sec: string, frac?: string) => {
        const fraction = frac ? Number(`0.${frac}`) : 0
        times.push(Number(min) * 60 + Number(sec) + fraction - shift)
        return ''
      })
      .trim()
    if (times.length) times.forEach((time) => lines.push({ time: Math.max(0, time), text }))
    else if (text && !/^\[[a-z]+:.*\]$/i.test(text)) plain.push(text)
  }

  if (lines.length) return { lines: lines.sort((a, b) => a.time - b.time), plain: null, source: 'file' }
  return plain.length ? { lines: null, plain: plain.join('\n'), source: 'file' } : null
}

async function fromSidecar(filePath: string): Promise<LyricsResult | null> {
  const dir = path.dirname(filePath)
  const wanted = `${path.basename(filePath, path.extname(filePath))}.lrc`.toLowerCase()
  try {
    const match = (await readdir(dir)).find((name) => name.toLowerCase() === wanted)
    if (!match) return null
    return parseLrc(await readFile(path.join(dir, match), 'utf8'))
  } catch {
    return null
  }
}

async function fromTags(filePath: string): Promise<LyricsResult | null> {
  try {
    const meta = await parseFile(filePath, { duration: false })
    for (const tag of meta.common.lyrics ?? []) {
      const timed = tag.syncText?.filter((l) => typeof l.timestamp === 'number' && l.text.trim())
      if (timed?.length && tag.timeStampFormat === TimestampFormat.milliseconds) {
        const lines = timed.map((l) => ({ time: (l.timestamp as number) / 1000, text: l.text.trim() }))
        return { lines: lines.sort((a, b) => a.time - b.time), plain: null, source: 'embedded' }
      }
      if (tag.text?.trim()) {
        const parsed = parseLrc(tag.text)
        if (parsed) return { ...parsed, source: 'embedded' }
      }
    }
  } catch {
    // unreadable tags are fine, the other sources may have it
  }
  return null
}

let lastRequest = 0

async function lrclib(pathname: string, params: Record<string, string>): Promise<unknown> {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequest = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await net.fetch(`https://lrclib.net/api/${pathname}?${new URLSearchParams(params)}`, {
      headers: { 'User-Agent': `BeatNode/${app.getVersion()} (https://github.com/jedgarf/BeatNode-Desktop)` },
      signal: controller.signal,
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`lrclib answered ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

interface LrclibEntry {
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

function fromLrclib(entry: LrclibEntry | null | undefined): LyricsResult | null {
  if (!entry || entry.instrumental) return null
  if (entry.syncedLyrics) {
    const parsed = parseLrc(entry.syncedLyrics)
    if (parsed?.lines) return { ...parsed, source: 'online' }
  }
  if (entry.plainLyrics?.trim()) return { lines: null, plain: entry.plainLyrics.trim(), source: 'online' }
  return null
}

async function fromOnline(request: LyricsRequest): Promise<LyricsResult | null> {
  const params: Record<string, string> = { track_name: request.title, artist_name: request.artist }
  if (request.album && request.album !== 'Unknown Album') params.album_name = request.album
  if (request.duration > 0) params.duration = String(Math.round(request.duration))

  const exact = fromLrclib((await lrclib('get', params)) as LrclibEntry | null)
  if (exact) return exact

  // tags and the catalog rarely agree on the album, so fall back to a looser search
  const found = (await lrclib('search', { track_name: request.title, artist_name: request.artist })) as LrclibEntry[] | null
  const close = (found ?? []).filter((e) => request.duration <= 0 || e.duration === undefined || Math.abs(e.duration - request.duration) <= 4)
  return fromLrclib(close.find((e) => e.syncedLyrics) ?? close.find((e) => e.plainLyrics))
}

interface CacheEntry {
  at: number
  result: LyricsResult | null
}

async function cached(id: string): Promise<CacheEntry | null> {
  try {
    return JSON.parse(await readFile(path.join(lyricsDir(), `${id}.json`), 'utf8')) as CacheEntry
  } catch {
    return null
  }
}

async function remember(id: string, result: LyricsResult | null) {
  await mkdir(lyricsDir(), { recursive: true })
  await writeFile(path.join(lyricsDir(), `${id}.json`), JSON.stringify({ at: Date.now(), result } satisfies CacheEntry))
}

async function findLyrics(request: LyricsRequest): Promise<LyricsResult | null> {
  const local = (await fromSidecar(request.path)) ?? (await fromTags(request.path))
  if (local) return local
  if (!getKv(ONLINE_KEY, true)) return null
  // without an artist the catalog would guess, and guesses show the wrong song's words
  if (!request.title.trim() || !request.artist.trim() || request.artist === 'Unknown Artist') return null

  const id = trackId(request.path)
  const hit = await cached(id)
  if (hit && (hit.result || Date.now() - hit.at < MISS_RETRY_MS)) return hit.result
  try {
    const result = await fromOnline(request)
    await remember(id, result)
    return result
  } catch (error) {
    // offline or the service is down, ask again next time rather than remember a miss
    console.warn(`[lyrics] online lookup failed for ${request.title}:`, error)
    return null
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value.slice(0, MAX_TEXT) : '')

export function registerLyricsIpc(): void {
  ipcMain.handle('lyrics:get', (_event, raw: unknown): Promise<LyricsResult | null> | null => {
    const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
    if (typeof r.path !== 'string' || !isGranted(r.path)) return null
    return findLyrics({
      path: path.normalize(r.path),
      title: text(r.title),
      artist: text(r.artist),
      album: text(r.album),
      duration: typeof r.duration === 'number' && Number.isFinite(r.duration) ? r.duration : 0,
    })
  })
  ipcMain.handle('onlineLyrics:get', () => getKv(ONLINE_KEY, true))
  ipcMain.handle('onlineLyrics:set', (_event, enabled: unknown) => {
    putKv(ONLINE_KEY, enabled === true)
  })
}
