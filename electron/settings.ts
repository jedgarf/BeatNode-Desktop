import { addExcluded, deleteKv, getKv, loadExcluded, putKv, removeExcluded } from './db'

export interface AppSettings {
  folders: string[]
  excluded: string[]
  syncFolder: string | null
}

export async function getSettings(): Promise<AppSettings> {
  return {
    folders: getKv<string[]>('folders', []),
    excluded: loadExcluded(),
    syncFolder: getKv<string | null>('syncFolder', null),
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  if (patch.folders) putKv('folders', patch.folders)
  if (patch.syncFolder !== undefined) {
    if (patch.syncFolder === null) deleteKv('syncFolder')
    else putKv('syncFolder', patch.syncFolder)
  }
  if (patch.excluded) {
    const next = new Set(patch.excluded)
    const current = loadExcluded()
    removeExcluded(current.filter((p) => !next.has(p)))
    for (const p of next) if (!current.includes(p)) addExcluded(p)
  }
  return getSettings()
}
