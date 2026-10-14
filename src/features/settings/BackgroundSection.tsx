import { useEffect, useState } from 'react'

export function BackgroundSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    window.beatnode.getBackgroundPlayback().then(setEnabled).catch(console.error)
  }, [])

  const toggle = () => {
    if (enabled === null) return
    const next = !enabled
    setEnabled(next)
    window.beatnode.setBackgroundPlayback(next).catch((error) => {
      console.error('[settings] could not save background playback:', error)
      setEnabled(!next)
    })
  }

  return (
    <section className="mb-6 rounded-2xl bg-fg/[0.04] p-5 ring-1 ring-fg/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg/50">Background playback</h2>
          <p className="mt-1 text-sm text-fg/50">
            Closing the window while music plays keeps it going from the system tray or menu bar, with play, pause and
            skip controls. Choose Quit from the tray menu to stop completely.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          aria-label="Keep playing in the background" title="Keep playing in the background"
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
