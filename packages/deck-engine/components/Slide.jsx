import { useRef, useEffect, useState } from 'react'
import { useSlides } from '../context/SlideContext'

const DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV

export default function Slide({ index, className = '', children }) {
  const { current, mode, isHidden } = useSlides()
  const ref = useRef(null)
  const [overflow, setOverflow] = useState(false)

  let stateClass = ''
  if (index === current) stateClass = 'active'
  else if (index < current) stateClass = 'exit-left'

  // Only surface "hidden" styling on the *active* slide in edit mode. Limiting
  // it to the active slide means an outgoing hidden slide drops the dim/hatch
  // the instant you navigate away, instead of carrying it through the slide
  // transition (which read as the overlay "lingering" for ~1s). Off-screen
  // slides are invisible anyway, so nothing is lost visually. In present mode
  // hidden slides are skipped entirely, so there is nothing to dim.
  const hiddenSlide = typeof isHidden === 'function' ? isHidden(index) : false
  const hiddenClass = hiddenSlide && mode === 'edit' && index === current ? 'deckio-slide--hidden' : ''

  useEffect(() => {
    if (!DEV || index !== current || !ref.current) return
    const el = ref.current
    const check = () => {
      // Only check flow-positioned children; ignore absolute/fixed decorations (orbs, accent-bar)
      const hasOverflow = Array.from(el.children).some(c => {
        const pos = getComputedStyle(c).position
        if (pos === 'absolute' || pos === 'fixed') return false
        return c.offsetTop + c.offsetHeight > el.clientHeight
      })
      setOverflow(hasOverflow)
    }
    check()
    const obs = new ResizeObserver(check)
    obs.observe(el)
    return () => obs.disconnect()
  }, [index, current])

  return (
    <div ref={ref} className={`slide ${stateClass} ${hiddenClass} ${className}`} data-slide={index}>
      {children}
      {DEV && overflow && (
        <div className="slide-overflow-warn">
          ⚠ Content overflows slide — reduce content or use smaller elements
        </div>
      )}
    </div>
  )
}
