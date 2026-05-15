import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'

/*  ╔══════════════════════════════════════════════════════════════╗
 *  ║                                                              ║
 *  ║   ▂▃▅▇█  S L I D E   C O N T E X T  █▇▅▃▂                  ║
 *  ║                                                              ║
 *  ║   Central state for slide navigation, persistence,           ║
 *  ║   keyboard / touch input, and customer selection.            ║
 *  ║                                                              ║
 *  ╚══════════════════════════════════════════════════════════════╝  */

const SlideContext = createContext()

/*  ┌─────────────────────────────────────────────────────────────┐
 *  │  ◆  H E L P E R S                                          │
 *  └─────────────────────────────────────────────────────────────┘  */

/**
 * Read initial slide from URL search params (?slide=N).
 * Takes priority over sessionStorage — enables deep-linking and
 * server-side capture (thumbnail service, vision capture) without postMessage.
 * Returns null if not present or invalid.
 */
function getSlideFromUrl(totalSlides) {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('slide')
    if (raw === null) return null
    const idx = parseInt(raw, 10)
    return Number.isFinite(idx) && idx >= 0 && idx < totalSlides ? idx : null
  } catch {
    return null
  }
}

/**
 * Recover the last-viewed slide from sessionStorage.
 * Survives Vite HMR so you stay on the same slide during dev.
 *
 *   sessionStorage key format:  slide:<project>
 *   returns 0 when nothing stored or value is out of range.
 */
function getStoredSlide(project, totalSlides) {
  try {
    const idx = parseInt(sessionStorage.getItem(`slide:${project}`), 10)
    return Number.isFinite(idx) && idx >= 0 && idx < totalSlides ? idx : 0
  } catch {
    return 0
  }
}

/*  ╭──────────────────────────────────────────────────────────────╮
 *  │  ◈  P R O V I D E R                                         │
 *  ╰──────────────────────────────────────────────────────────────╯  */

const DEFAULT_THEME = 'dark'
const INTERACTIVE_KEY_TARGET = 'button, a, input, textarea, select, [contenteditable], [role="button"], [role="link"]'

function isInteractiveKeyTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_KEY_TARGET))
}

export function SlideProvider({ children, totalSlides, project, slides, theme }) {
  const [current, setCurrent] = useState(() =>
    getSlideFromUrl(totalSlides) ?? getStoredSlide(project, totalSlides),
  )
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [activeTheme, setActiveTheme] = useState(theme || DEFAULT_THEME)

  /*  🎨 ─────────────────────────────────────────────
   *  │  Theme → data-theme on <html> for CSS hooks  │
   *  ───────────────────────────────────────── 🎨   */

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme)
    return () => document.documentElement.removeAttribute('data-theme')
  }, [activeTheme])

  // Sync if the theme prop changes at runtime (e.g. HMR / config reload)
  useEffect(() => {
    if (theme && theme !== activeTheme) setActiveTheme(theme)
  }, [theme])

  /*  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
   *  ░  Persist slide index  ─  HMR keeps position  ░
   *  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  */

  useEffect(() => {
    try {
      sessionStorage.setItem(`slide:${project}`, current)
    } catch {
      /* storage full / unavailable – ignore */
    }
  }, [current, project])

  /*  📡 ─────────────────────────────────────────────
   *  │  Notify parent window of slide changes        │
   *  │  (used by deck-launcher to provide context)   │
   *  ───────────────────────────────────────── 📡   */

  useEffect(() => {
    try {
      if (window.parent && window.parent !== window) {
        const slideName = slides?.[current]?.displayName || slides?.[current]?.name || ''
        window.parent.postMessage({
          type: 'deck:slide',
          project,
          slideIndex: current,
          slideName,
          totalSlides,
        }, '*')
      }
    } catch {
      /* cross-origin or non-iframe – ignore */
    }
  }, [current, project, totalSlides, slides])

  /*  ▸ ▸ ▸  Navigation helpers  ◂ ◂ ◂  */

  const go = useCallback(
    (dir) => {
      setCurrent((prev) => {
        const next = prev + dir
        return next < 0 || next >= totalSlides ? prev : next
      })
    },
    [totalSlides],
  )

  const goTo = useCallback(
    (idx) => {
      if (idx >= 0 && idx < totalSlides) setCurrent(idx)
    },
    [totalSlides],
  )

  /*  ⌨ ─────────────────────────────────────────────────────
   *  │  Keyboard  →  ←  Space  PageDown  PageUp  Enter    │
   *  ───────────────────────────────────────────────── ⌨  */

  useEffect(() => {
    const handler = (e) => {
      if (isInteractiveKeyTarget(e.target)) return

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') {
        e.preventDefault()
        go(1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [go])

  /*  📨 ──────────────────────────────────────────
   *  │  postMessage listener for deck:goTo        │
   *  │  Allows parent (launcher) to navigate      │
   *  ────────────────────────────────────── 📨   */

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'deck:goTo' && e.data.project === project) {
        const idx = e.data.slideIndex
        if (typeof idx === 'number' && idx >= 0 && idx < totalSlides) {
          setCurrent(idx)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [project, totalSlides])

  /*  👆 ─────────────────────────────────
   *  │  Touch / swipe  (threshold 50px) │
   *  ───────────────────────────── 👆   */

  useEffect(() => {
    let touchX = 0

    const onStart = (e) => {
      touchX = e.changedTouches[0].screenX
    }
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

  /*  ◇─────────────── render ───────────────◇  */

  return (
    <SlideContext.Provider
      value={{
        current,
        totalSlides,
        go,
        goTo,
        selectedCustomer,
        setSelectedCustomer,
        project,
        theme: activeTheme,
        setTheme: setActiveTheme,
      }}
    >
      {children}
    </SlideContext.Provider>
  )
}

/*  ┌─────────────────────────────────────────────────────────────┐
 *  │  ◆  H O O K                                                │
 *  └─────────────────────────────────────────────────────────────┘  */

export function useSlides() {
  return useContext(SlideContext)
}
