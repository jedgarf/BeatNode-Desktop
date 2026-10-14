import { useImportTracks } from './useImportTracks'

export function EmptyLibrary() {
  const { importTracks, isImporting, error } = useImportTracks()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <div>
        <h2 className="text-xl font-semibold">Your library is empty</h2>
        <p className="mt-1 text-sm text-fg/50">Add music (MP3, FLAC, WAV, M4A) or videos (MP4, WEBM, MOV, M4V) from your computer.</p>
      </div>
      <button
        type="button"
        onClick={importTracks}
        disabled={isImporting}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-glow transition hover:bg-accent-soft disabled:opacity-60"
      >
        {isImporting ? 'Importing…' : 'Add media'}
      </button>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
