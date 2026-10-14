import { useState } from 'react'
import { useSyncStore } from '../sync/store'

function statusLabel(status: ReturnType<typeof useSyncStore.getState>['status'], lastSyncedAt: number | null, error: string | null) {
  switch (status) {
    case 'syncing':
      return 'Syncing…'
    case 'synced':
      return lastSyncedAt ? `Up to date · ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Up to date'
    case 'error':
      return error ?? 'Sync failed'
    default:
      return 'Off'
  }
}

export function SyncSection() {
  const { folder, status, lastSyncedAt, error, setFolder } = useSyncStore()
  const [busy, setBusy] = useState(false)

  const choose = async () => {
    setBusy(true)
    try {
      setFolder(await window.beatnode.chooseSyncFolder())
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      await window.beatnode.disableSync()
      setFolder(null)
    } finally {
      setBusy(false)
    }
  }

  const tone = status === 'error' ? 'text-red-400' : status === 'synced' ? 'text-emerald-500' : 'text-fg/50'

  return (
    <section className="mb-6 rounded-2xl bg-fg/[0.04] p-5 ring-1 ring-fg/10">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg/50">Sync</h2>
        <span className={`text-xs ${tone}`}>{statusLabel(status, lastSyncedAt, error)}</span>
      </div>
      <p className="mb-4 text-sm text-fg/50">
        Pick a folder inside iCloud Drive, Dropbox, OneDrive or Google Drive. BeatNode keeps your playlists in it, and
        any device pointed at the same folder stays in step. Music files aren’t uploaded — keep them in the same
        synced location on each device so songs match.
      </p>

      {folder && (
        <p className="mb-4 truncate rounded-xl bg-fg/[0.04] px-3 py-2 text-sm" title={folder}>{folder}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={choose}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-glow transition hover:bg-accent-soft disabled:opacity-60"
        >
          {folder ? 'Change folder' : 'Choose folder'}
        </button>
        {folder && (
          <button
            type="button"
            disabled={busy}
            onClick={disable}
            className="rounded-full px-4 py-2 text-sm text-fg/70 ring-1 ring-fg/10 transition hover:text-fg disabled:opacity-40"
          >
            Turn off
          </button>
        )}
      </div>
    </section>
  )
}
