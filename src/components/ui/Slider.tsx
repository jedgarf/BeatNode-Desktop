import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

interface SliderProps {
  value: number
  max: number
  onChange?: (value: number) => void
  onCommit: (value: number) => void
  label: string
  valueText?: string
  step?: number
  disabled?: boolean
  className?: string
}

export function Slider({ value, max, onChange, onCommit, label, valueText, step = max / 20, disabled, className = '' }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)

  const valueFromPointer = useCallback(
    (event: PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return 0
      return Math.min(max, Math.max(0, ((event.clientX - rect.left) / rect.width) * max))
    },
    [max],
  )

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = valueFromPointer(event)
    setDragValue(next)
    onChange?.(next)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return
    const next = valueFromPointer(event)
    setDragValue(next)
    onChange?.(next)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return
    onCommit(valueFromPointer(event))
    setDragValue(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? step : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : 0
    if (!delta) return
    event.preventDefault()
    event.stopPropagation() // Keep global shortcuts from double-handling.
    onCommit(Math.min(max, Math.max(0, value + delta)))
  }

  const shown = dragValue ?? value
  const percent = max > 0 ? Math.min(100, (shown / max) * 100) : 0
  const dragging = dragValue !== null

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={valueText}
      aria-disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={`group relative flex h-4 touch-none items-center ${disabled ? 'opacity-40' : 'cursor-pointer'} ${className}`}
    >
      <div ref={trackRef} className="relative h-1 w-full rounded-full bg-fg/15">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${dragging ? 'bg-accent-soft' : 'bg-fg/80 group-hover:bg-accent-soft'} transition-colors`}
          style={{ width: `${percent}%` }}
        />
        <div
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[0_0_10px_var(--c-glow)] transition-opacity ${dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  )
}
