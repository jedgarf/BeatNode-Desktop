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

async function lrclib(pathname: string, params: Record<string, string>, retry = true): Promise<unknown> {
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
    if (response.status >= 500 && retry) {
      clearTimeout(timer)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      return lrclib(pathname, params, false)
    }
    if (!response.ok) throw new Error(`lrclib answered ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

interface LrclibEntry {
  trackName?: string
  artistName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

// a different cut of the same song is a few seconds off, past this the timing would drift too far
const DURATION_TOLERANCE_SECONDS = 10

// "Céline Dion / The Power of Love (Remastered)" -> "celinedion/powerofove" style key, spaces and marks gone
function squash(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^the/, '')
}

// "Celine Dion ft. R Kelly" -> "Celine Dion", the catalog lists the lead artist first more often than not
function leadArtist(artist: string): string {
  return artist.split(/\s+(?:ft\.?|feat\.?|featuring|with|x|&|and)\s+|\s*[,;/]\s*/i)[0].trim()
}

function stripNoise(title: string): string {
  return title.replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/\s+-\s+(remaster(ed)?|live|radio edit|official.*)$/i, '').trim()
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}

function sameTitle(wanted: string, candidate: string, artist: string): boolean {
  // some uploads are named "Artist - Title", so drop the artist before comparing
  const name = squash(candidate).replace(squash(artist), '')
  if (!wanted || !name) return false
  if (name === wanted || name.includes(wanted) || wanted.includes(name)) return true
  // a typo or two in the tags still counts
  return 1 - distance(wanted, name) / Math.max(wanted.length, name.length) >= 0.82
}

function sameArtist(wanted: string, candidate: string): boolean {
  const a = squash(wanted)
  const b = squash(candidate)
  return !a || !b || a.includes(b) || b.includes(a)
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

// pick the entry that is the same song, preferring timed lyrics and then the closest length
export function pickEntry(entries: LrclibEntry[], request: LyricsRequest): LrclibEntry | null {
  const artist = leadArtist(request.artist)
  const title = squash(stripNoise(request.title))
  const matching = entries.filter((e) => !e.instrumental && sameArtist(artist, e.artistName ?? '') && sameTitle(title, e.trackName ?? '', artist))
  const gap = (e: LrclibEntry) => (request.duration > 0 && e.duration ? Math.abs(e.duration - request.duration) : 0)
  const byCloseness = (a: LrclibEntry, b: LrclibEntry) => gap(a) - gap(b)

  const timed = matching.filter((e) => e.syncedLyrics && gap(e) <= DURATION_TOLERANCE_SECONDS).sort(byCloseness)
  if (timed[0]) return timed[0]
  // words without timing don't depend on the length, so any cut will do
  return matching.filter((e) => e.plainLyrics || e.syncedLyrics).sort(byCloseness)[0] ?? null
}

export async function fromOnline(request: LyricsRequest): Promise<LyricsResult | null> {
  const artist = leadArtist(request.artist)
  const title = stripNoise(request.title)

  const exact: Record<string, string> = { track_name: title, artist_name: artist }
  if (request.album && request.album !== 'Unknown Album') exact.album_name = request.album
  if (request.duration > 0) exact.duration = String(Math.round(request.duration))
  const direct = (await lrclib('get', exact)) as LrclibEntry | null
  if (direct && !direct.instrumental) {
    const result = fromLrclib(direct)
    if (result) return result
  }

  // free text copes with "The", spacing and spelling, the structured search is the tighter second try
  // the search is word based, so "HeartBeat" finds nothing where "Heart Beat" does
  const spaced = title.replace(/([a-z])([A-Z])/g, '$1 $2')
  const queries: Array<Record<string, string>> = [{ q: `${artist} ${title}` }]
  if (spaced !== title) queries.push({ q: `${artist} ${spaced}` })
  queries.push({ track_name: title, artist_name: artist })
  for (const query of queries) {
    const found = (await lrclib('search', query)) as LrclibEntry[] | null
    const picked = pickEntry(found ?? [], request)
    const result = fromLrclib(picked)
    if (result) return result
  }
  return null
}

// bump when the matching gets better, so misses from the old rules are looked up again
const MATCHER_VERSION = 2

interface CacheEntry {
  v?: number
  at: number
  result: LyricsResult | null
}

async function cached(id: string): Promise<CacheEntry | null> {
  try {
    const entry = JSON.parse(await readFile(path.join(lyricsDir(), `${id}.json`), 'utf8')) as CacheEntry
    // a hit stays good, only the misses depend on how clever the matching was
    return entry.result || entry.v === MATCHER_VERSION ? entry : null
  } catch {
    return null
  }
}

async function remember(id: string, result: LyricsResult | null) {
  await mkdir(lyricsDir(), { recursive: true })
  await writeFile(path.join(lyricsDir(), `${id}.json`), JSON.stringify({ v: MATCHER_VERSION, at: Date.now(), result } satisfies CacheEntry))
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
