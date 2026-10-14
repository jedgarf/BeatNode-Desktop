import { useEffect, useState } from 'react'

export function FoldersSection() {
  const [folders, setFolders] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.beatnode.getFolders().then(setFolders).catch(console.error)
    return window.beatnode.onScanState(setScanning)
  }, [])

  const run = async (action: () => Promise<string[] | void>) => {
    setBusy(true)
    try {
      const next = await action()
      if (next) setFolders(next)
    } catch (error) {
      console.error('[folders] action failed:', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl bg-fg/[0.04] p-5 ring-1 ring-fg/10">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg/50">Music folders</h2>
        {scanning && <span className="text-xs text-accent-soft">Scanning…</span>}
      </div>
      <p className="mb-4 text-sm text-fg/50">
        Songs in these folders are added automatically, and removed when the files are deleted.
      </p>

      {folders.length === 0 ? (
        <p className="mb-4 rounded-xl bg-fg/[0.04] px-3 py-3 text-sm text-fg/50">No folders yet.</p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {folders.map((folder) => (
            <li key={folder} className="flex items-center justify-between gap-3 rounded-xl bg-fg/[0.04] px-3 py-2">
              <span className="min-w-0 truncate text-sm" title={folder}>{folder}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => window.beatnode.removeFolder(folder))}
                className="shrink-0 text-xs text-fg/50 transition hover:text-red-400 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => window.beatnode.addFolders())}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-glow transition hover:bg-accent-soft disabled:opacity-60"
        >
          Add folder
        </button>
        <button
          type="button"
          disabled={busy || scanning || folders.length === 0}
          onClick={() => run(() => window.beatnode.rescanFolders())}
          className="rounded-full px-4 py-2 text-sm text-fg/70 ring-1 ring-fg/10 transition hover:text-fg disabled:opacity-40"
        >
          Rescan now
        </button>
      </div>
    </section>
  )
}
