import { StickyHeader } from '../../components/layout/StickyHeader'
import { Greeting } from '../../components/ui/Greeting'
import { selectCurrentTrack, usePlayerStore } from '../player/store'
import { EmptyLibrary } from './EmptyLibrary'
import { TrackCard } from './TrackCard'

export function HomeView() {
  const library = usePlayerStore((s) => s.library)
  const currentId = usePlayerStore((s) => selectCurrentTrack(s)?.id)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playTrack = usePlayerStore((s) => s.playTrack)
  const togglePlay = usePlayerStore((s) => s.togglePlay)

  const recent = [...library].reverse().slice(0, 12)

  return (
    <div className="flex min-h-full flex-col">
      <StickyHeader>{(compact) => <Greeting compact={compact} className={compact ? 'mb-0' : 'mb-8'} />}</StickyHeader>
      {recent.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Recently added</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-4">
            {recent.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isCurrent={track.id === currentId}
                isPlaying={isPlaying}
                onPlay={() => (track.id === currentId ? togglePlay() : playTrack(track.id, library))}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
