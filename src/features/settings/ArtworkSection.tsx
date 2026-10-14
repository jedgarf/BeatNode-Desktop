import { useEffect, useState } from 'react'

export function ArtworkSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    window.beatnode.getOnlineArtwork().then(setEnabled).catch(console.error)
  }, [])

  const toggle = () => {
    if (enabled === null) return
    const next = !enabled
    setEnabled(next)
    window.beatnode.setOnlineArtwork(next).catch((error) => {
      console.error('[settings] could not save online artwork:', error)
      setEnabled(!next)
    })
  }

  return (
    <section className="mb-6 rounded-2xl bg-fg/[0.04] p-5 ring-1 ring-fg/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg/50">Artwork</h2>
          <p className="mt-1 text-sm text-fg/50">
            Songs without built-in artwork use a cover.jpg or folder.jpg next to the file. When neither exists, BeatNode
            looks up the song title and artist on the iTunes catalog to find the album cover.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          aria-label="Find missing artwork online"
          disabled={enabled === null}
          onClick={toggle}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-accent' : 'bg-fg/20'} disabled:opacity-50`}
        >
          <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    </section>
  )
}
