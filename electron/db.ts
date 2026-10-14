import { existsSync, readFileSync, renameSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import type { Playlist, Track } from '../src/shared/types'
import { trackKey } from './library'

// one sqlite file for library, playlists and settings. version lives in user_version
let db: Database.Database | null = null

const LEGACY_FILES = ['library.json', 'playlists.json', 'settings.json'] as const

const SCHEMA_V1 = `
  CREATE TABLE tracks (
    id        TEXT PRIMARY KEY,
    path      TEXT NOT NULL UNIQUE,
    title     TEXT NOT NULL,
    artist    TEXT NOT NULL,
    album     TEXT NOT NULL,
    duration  REAL NOT NULL DEFAULT 0,
    cover     TEXT,
    key       TEXT NOT NULL
  );
  CREATE INDEX idx_tracks_key ON tracks(key);

  CREATE TABLE playlists (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE playlist_entries (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    key         TEXT NOT NULL,
    title       TEXT NOT NULL,
    artist      TEXT NOT NULL,
    PRIMARY KEY (playlist_id, position)
  );

  CREATE TABLE excluded_paths (path TEXT PRIMARY KEY);
  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`

export function getDb(): Database.Database {
  if (db) return db
  const instance = new Database(path.join(app.getPath('userData'), 'beatnode.db'))
  instance.pragma('journal_mode = WAL')
  instance.pragma('synchronous = NORMAL')
  instance.pragma('foreign_keys = ON')

  const version = instance.pragma('user_version', { simple: true }) as number
  if (version < 1) {
    instance.transaction(() => {
      instance.exec(SCHEMA_V1)
      importLegacyJson(instance)
      instance.pragma('user_version = 1')
    })()
    retireLegacyFiles()
  }
  if (version < 2) {
    // v2: videos. old rows are all audio
    instance.transaction(() => {
      instance.exec("ALTER TABLE tracks ADD COLUMN kind TEXT NOT NULL DEFAULT 'audio'")
      instance.pragma('user_version = 2')
    })()
  }
  db = instance
  return instance
}

export function closeDb(): void {
  db?.close()
  db = null
}


function readLegacy(name: string): unknown {
  try {
    return JSON.parse(readFileSync(path.join(app.getPath('userData'), name), 'utf8'))
  } catch {
    return null
  }
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

function importLegacyJson(instance: Database.Database): void {
  const legacyTracks = readLegacy('library.json')
  const byLegacyId = new Map<string, Track>()
  if (Array.isArray(legacyTracks)) {
    const insert = instance.prepare(
      'INSERT OR IGNORE INTO tracks (id, path, title, artist, album, duration, cover, key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (const raw of legacyTracks) {
      if (typeof raw?.id !== 'string' || typeof raw?.path !== 'string') continue
      const title = str(raw.title, path.basename(raw.path))
      const artist = str(raw.artist, 'Unknown Artist')
      const album = str(raw.album, 'Unknown Album')
      const cover = typeof raw.cover === 'string' && raw.cover.startsWith('beatnode://') ? raw.cover : null
      const key = trackKey(artist, title, album)
      insert.run(raw.id, raw.path, title, artist, album, typeof raw.duration === 'number' ? raw.duration : 0, cover, key)
      byLegacyId.set(raw.id, { key, title, artist } as Track)
    }
  }

  const legacyPlaylists = readLegacy('playlists.json')
  if (Array.isArray(legacyPlaylists)) {
    const playlists: Playlist[] = []
    for (const raw of legacyPlaylists) {
      if (typeof raw?.id !== 'string' || typeof raw?.name !== 'string') continue
      let entries: Playlist['entries'] = []
      if (Array.isArray(raw.entries)) {
        entries = raw.entries.filter((e: unknown) => typeof (e as Playlist['entries'][0])?.key === 'string')
      } else if (Array.isArray(raw.trackIds)) {
        entries = raw.trackIds.flatMap((id: unknown) => {
          const t = typeof id === 'string' ? byLegacyId.get(id) : undefined
          return t ? [{ key: t.key, title: t.title, artist: t.artist }] : []
        })
      }
      const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now()
      playlists.push({
        id: raw.id,
        name: raw.name,
        entries,
        createdAt,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt,
        ...(raw.deleted === true ? { deleted: true } : {}),
      })
    }
    writePlaylists(instance, playlists)
  }

  const legacySettings = readLegacy('settings.json') as { folders?: unknown; excluded?: unknown; syncFolder?: unknown } | null
  if (legacySettings) {
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
    setKv(instance, 'folders', strings(legacySettings.folders))
    if (typeof legacySettings.syncFolder === 'string') setKv(instance, 'syncFolder', legacySettings.syncFolder)
    const insert = instance.prepare('INSERT OR IGNORE INTO excluded_paths (path) VALUES (?)')
    strings(legacySettings.excluded).forEach((p) => insert.run(p))
  }
}

// leave the old json around as .migrated
function retireLegacyFiles(): void {
  for (const name of LEGACY_FILES) {
    const file = path.join(app.getPath('userData'), name)
    if (existsSync(file)) {
      try {
        renameSync(file, `${file}.migrated`)
      } catch (error) {
        console.warn(`[db] could not retire ${name}:`, error)
      }
    }
  }
}


function setKv(instance: Database.Database, key: string, value: unknown): void {
  instance
    .prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value))
}

export function getKv<T>(key: string, fallback: T): T {
  const row = getDb().prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export function putKv(key: string, value: unknown): void {
  setKv(getDb(), key, value)
}

export function deleteKv(key: string): void {
  getDb().prepare('DELETE FROM kv WHERE key = ?').run(key)
}


export function loadExcluded(): string[] {
  return (getDb().prepare('SELECT path FROM excluded_paths').all() as Array<{ path: string }>).map((r) => r.path)
}

export function addExcluded(filePath: string): void {
  getDb().prepare('INSERT OR IGNORE INTO excluded_paths (path) VALUES (?)').run(filePath)
}

export function removeExcluded(paths: string[]): void {
  const stmt = getDb().prepare('DELETE FROM excluded_paths WHERE path = ?')
  getDb().transaction(() => paths.forEach((p) => stmt.run(p)))()
}


export function loadTracks(): unknown[] {
  return getDb().prepare('SELECT id, path, title, artist, album, duration, cover, kind FROM tracks ORDER BY rowid').all()
}

export function saveTracks(tracks: Track[]): void {
  const database = getDb()
  const upsert = database.prepare(`
    INSERT INTO tracks (id, path, title, artist, album, duration, cover, key, kind)
    VALUES (@id, @path, @title, @artist, @album, @duration, @cover, @key, @kind)
    ON CONFLICT(id) DO UPDATE SET
      path = excluded.path, title = excluded.title, artist = excluded.artist, album = excluded.album,
      duration = excluded.duration, cover = excluded.cover, key = excluded.key, kind = excluded.kind
  `)
  // path is unique, so clear a row with the same path but another id first
  const dropStale = database.prepare('DELETE FROM tracks WHERE path = ? AND id != ?')
  database.transaction(() => {
    database.exec('CREATE TEMP TABLE IF NOT EXISTS keep_ids (id TEXT PRIMARY KEY)')
    database.exec('DELETE FROM keep_ids')
    const keep = database.prepare('INSERT OR IGNORE INTO keep_ids (id) VALUES (?)')
    for (const t of tracks) {
      dropStale.run(t.path, t.id)
      upsert.run({
        id: t.id,
        path: t.path,
        title: str(t.title),
        artist: str(t.artist, 'Unknown Artist'),
        album: str(t.album, 'Unknown Album'),
        duration: typeof t.duration === 'number' ? t.duration : 0,
        cover: t.cover ?? null,
        key: str(t.key) || trackKey(t.artist, t.title, t.album),
        kind: t.kind === 'video' ? 'video' : 'audio',
      })
      keep.run(t.id)
    }
    database.exec('DELETE FROM tracks WHERE id NOT IN (SELECT id FROM keep_ids)')
  })()
}


export function loadPlaylists(): Playlist[] {
  const database = getDb()
  const rows = database
    .prepare('SELECT id, name, created_at, updated_at, deleted FROM playlists ORDER BY created_at, id')
    .all() as Array<{ id: string; name: string; created_at: number; updated_at: number; deleted: number }>
  const entryRows = database
    .prepare('SELECT playlist_id, key, title, artist FROM playlist_entries ORDER BY playlist_id, position')
    .all() as Array<{ playlist_id: string; key: string; title: string; artist: string }>

  const entriesById = new Map<string, Playlist['entries']>()
  for (const e of entryRows) {
    const list = entriesById.get(e.playlist_id) ?? []
    list.push({ key: e.key, title: e.title, artist: e.artist })
    entriesById.set(e.playlist_id, list)
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    entries: entriesById.get(r.id) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.deleted ? { deleted: true } : {}),
  }))
}

function writePlaylists(database: Database.Database, playlists: Playlist[]): void {
  const upsert = database.prepare(`
    INSERT INTO playlists (id, name, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, created_at = excluded.created_at,
      updated_at = excluded.updated_at, deleted = excluded.deleted
  `)
  const clearEntries = database.prepare('DELETE FROM playlist_entries WHERE playlist_id = ?')
  const insertEntry = database.prepare(
    'INSERT OR REPLACE INTO playlist_entries (playlist_id, position, key, title, artist) VALUES (?, ?, ?, ?, ?)',
  )
  database.exec('CREATE TEMP TABLE IF NOT EXISTS keep_playlists (id TEXT PRIMARY KEY)')
  database.exec('DELETE FROM keep_playlists')
  const keep = database.prepare('INSERT OR IGNORE INTO keep_playlists (id) VALUES (?)')

  for (const p of playlists) {
    upsert.run(p.id, p.name, p.createdAt, p.updatedAt, p.deleted ? 1 : 0)
    clearEntries.run(p.id)
    p.entries.forEach((e, i) => insertEntry.run(p.id, i, e.key, e.title, e.artist))
    keep.run(p.id)
  }
  database.exec('DELETE FROM playlists WHERE id NOT IN (SELECT id FROM keep_playlists)')
}

export function savePlaylists(playlists: Playlist[]): void {
  const database = getDb()
  database.transaction(() => writePlaylists(database, playlists))()
}
