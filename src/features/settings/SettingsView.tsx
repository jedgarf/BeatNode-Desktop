import { StickyHeader } from '../../components/layout/StickyHeader'
import { SettingsIcon } from '../../components/ui/icons'
import { PageTitle } from '../../components/ui/PageTitle'
import { ArtworkSection } from './ArtworkSection'
import { BackgroundSection } from './BackgroundSection'
import { FoldersSection } from './FoldersSection'
import { LyricsSection } from './LyricsSection'
import { SyncSection } from './SyncSection'
import { useThemeStore, type ThemeMode } from './theme'

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; hint: string }> = [
  { id: 'system', label: 'System', hint: 'Match your OS' },
  { id: 'light', label: 'Light', hint: 'Bright and clean' },
  { id: 'dark', label: 'Dark', hint: 'Easy on the eyes' },
]

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Play / pause'],
  ['← / →', 'Seek 5 seconds'],
  ['↑ / ↓', 'Volume'],
  ['M', 'Mute'],
  ['F', 'Fullscreen (video)'],
  ['Esc', 'Close Now Playing'],
]

export function SettingsView() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  return (
    <div>
      <StickyHeader>
        {(compact) => (
          <PageTitle compact={compact} icon={<SettingsIcon />} className={compact ? 'mb-0' : 'mb-8'}>
            Settings
          </PageTitle>
        )}
      </StickyHeader>
      <section className="mb-6 rounded-2xl bg-fg/[0.04] p-5 ring-1 ring-fg/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg/50">Appearance</h2>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => {
            const checked = option.id === mode
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setMode(option.id)}
                className={`rounded-xl px-3 py-3 text-left ring-1 transition ${checked ? 'bg-accent/15 ring-accent' : 'bg-fg/[0.03] ring-fg/10 hover:bg-fg/[0.07]'}`}
              >
                <span className={`block text-sm font-semibold ${checked ? 'text-accent-soft' : ''}`}>{option.label}</span>
                <span className="block text-xs text-fg/50">{option.hint}</span>
              </button>
            )
          })}
        </div>
      </section>
      <BackgroundSection />
      <ArtworkSection />
      <LyricsSection />
      <FoldersSection />
      <SyncSection />
      <section className="rounded-2xl bg-fg/[0.04] p-5 ring-1 ring-fg/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg/50">Keyboard shortcuts</h2>
        <dl className="space-y-2">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="flex items-center justify-between text-sm">
              <dt className="text-fg/70">{action}</dt>
              <dd><kbd className="rounded-md bg-fg/10 px-2 py-0.5 font-mono text-xs">{keys}</kbd></dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
