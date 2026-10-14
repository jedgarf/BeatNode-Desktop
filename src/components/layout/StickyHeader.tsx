import { useEffect, useRef, useState, type ReactNode } from 'react'

export const HEADER_EASE = 'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'

// keeps a page header in view while the page scrolls under it. children get `compact`, and draw
// themselves smaller when it is true, so the same controls ease down instead of being swapped
export function StickyHeader({ children }: { children: (compact: boolean) => ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const marker = sentinel.current
    if (!marker) return
    // the 48px strip at the top belongs to the window drag area, the header sticks right under it
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { rootMargin: '-49px 0px 0px 0px' })
    observer.observe(marker)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div
        className={`sticky top-12 z-20 -mx-8 border-b px-8 backdrop-blur-xl before:absolute before:inset-x-0 before:-top-12 before:h-12 before:bg-base before:transition-opacity before:duration-300 ${HEADER_EASE} ${
          compact ? 'border-fg/10 bg-base/90 py-2.5 before:opacity-100' : 'border-transparent bg-base/0 py-0 before:opacity-0'
        }`}
      >
        {children(compact)}
      </div>
    </>
  )
}
