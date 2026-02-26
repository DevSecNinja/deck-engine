import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const SlideContext = createContext()

export function SlideProvider({ children, totalSlides }) {
  const [current, setCurrent] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const go = useCallback((dir) => {
    setCurrent(prev => {
      const next = prev + dir
      if (next < 0 || next >= totalSlides) return prev
      return next
    })
  }, [totalSlides])

  const goTo = useCallback((idx) => {
    if (idx >= 0 && idx < totalSlides) setCurrent(idx)
  }, [totalSlides])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [go])

  // Touch swipe
  useEffect(() => {
    let touchX = 0
    const onStart = (e) => { touchX = e.changedTouches[0].screenX }
    const onEnd = (e) => {
      const diff = touchX - e.changedTouches[0].screenX
      if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1)
    }
    document.addEventListener('touchstart', onStart)
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [go])

  return (
    <SlideContext.Provider value={{ current, totalSlides, go, goTo, selectedCustomer, setSelectedCustomer }}>
      {children}
    </SlideContext.Provider>
  )
}

export function useSlides() {
  return useContext(SlideContext)
}
