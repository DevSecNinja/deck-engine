import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  lazy,
  Suspense,
} from 'react'
import {
  normalizeHidden,
  computeVisibleIndices,
  stepVisible,
  resolveGoTo,
  snapToVisible,
  displayMetrics,
  resolveEffectiveMode,
  resolveInitialMode as resolveInitialModeFromSearch,
} from './nav-utils'

// Dev-only "star us" nudge, lazy-loaded so it never enters the engine's
// production import graph (built/offline decks ship without it) and never adds
// to the cost of importing this module (e.g. the index.js re-export smoke
// tests). It only resolves on the dev server while editing — see the gated
// render below and the component's own guards.
const GitHubStarPrompt = lazy(() => import('../components/GitHubStarPrompt.jsx'))

const STAR_PROMPT_DEV = (() => {
  try {
    return Boolean(import.meta && import.meta.env && import.meta.env.DEV)
  } catch {
    return false
  }
})()

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

/**
 * Decide the initial edit/present mode (URL params + prop + dev flag).
 */
function resolveInitialMode(modeProp) {
  let search = ''
  try { search = window.location.search } catch { /* SSR */ }
  return resolveInitialModeFromSearch(search, modeProp, import.meta.env?.DEV)
}

/*  ╭──────────────────────────────────────────────────────────────╮
 *  │  ◈  P R O V I D E R                                         │
 *  ╰──────────────────────────────────────────────────────────────╯  */

const DEFAULT_THEME = 'dark'
const INTERACTIVE_KEY_TARGET = 'button, a, input, textarea, select, [contenteditable], [role="button"], [role="link"]'

function isInteractiveKeyTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_KEY_TARGET))
}

export function SlideProvider({ children, totalSlides, project, slides, theme, hiddenSlides, mode }) {
  const [current, setCurrent] = useState(() =>
    getSlideFromUrl(totalSlides) ?? getStoredSlide(project, totalSlides),
  )
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [activeTheme, setActiveTheme] = useState(theme || DEFAULT_THEME)
  const [activeMode, setActiveMode] = useState(() => resolveInitialMode(mode))

  /*  ⛶ ─────────────────────────────────────────────
   *  │  Browser fullscreen → force present visibility │
   *  │  Standalone decks shown fullscreen skip hidden │
   *  │  slides even when the active mode is edit.      │
   *  ───────────────────────────────────────── ⛶   */
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const sync = () => {
      try {
        setIsFullscreen(Boolean(document.fullscreenElement))
      } catch {
        setIsFullscreen(false)
      }
    }
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  /*  🙈 ─────────────────────────────────────────────
   *  │  Hidden slides (durable, from deck.config.js) │
   *  │  Present mode skips them; edit mode shows all │
   *  ───────────────────────────────────────── 🙈   */

  // Stable key so the effect only re-runs on real changes (arrays get a fresh
  // identity each render). hiddenSlides is authored in deck.config.js and
  // updated via the slide-op endpoint, which triggers a full reload.
  const hiddenKey = JSON.stringify(Array.isArray(hiddenSlides) ? hiddenSlides : [])
  const [hidden, setHidden] = useState(() => normalizeHidden(hiddenSlides, totalSlides))
  useEffect(() => {
    setHidden(normalizeHidden(hiddenSlides, totalSlides))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenKey, totalSlides])

  const hiddenSet = useMemo(() => new Set(hidden), [hidden])

  // Fullscreen forces present behaviour; otherwise the active mode wins.
  const effectiveMode = resolveEffectiveMode(activeMode, isFullscreen)

  // Absolute indices reachable in the current mode. Present mode drops hidden
  // slides; edit mode keeps everything (hidden are shown dimmed with controls).
  const visibleIndices = useMemo(
    () => computeVisibleIndices(totalSlides, hiddenSet, effectiveMode),
    [totalSlides, effectiveMode, hiddenSet],
  )

  // Present-aware display helpers (Navigation, progress, edit overlays, and the
  // launcher's slide counter via the deck:slide message below).
  const { displayIndex, visibleCount, progress, atStart, atEnd, firstVisibleIndex } =
    displayMetrics(current, visibleIndices, effectiveMode, totalSlides)

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

  // Sync if the mode prop changes at runtime (explicit override).
  useEffect(() => {
    if ((mode === 'edit' || mode === 'present') && mode !== activeMode) {
      setActiveMode(mode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

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
          hiddenSlides: hidden,
          mode: effectiveMode,
          // Present-aware counter values so consumers (launcher presentation
          // bar) can show "visible / visible" instead of counting hidden.
          displayIndex,
          visibleCount,
        }, '*')
      }
    } catch {
      /* cross-origin or non-iframe – ignore */
    }
  }, [current, project, totalSlides, slides, hidden, effectiveMode, displayIndex, visibleCount])

  /*  ▸ ▸ ▸  Navigation helpers  ◂ ◂ ◂  */

  // In present mode, navigation steps through visible slides only; in edit mode
  // every slide is reachable so hidden slides can still be inspected/un-hidden.
  const go = useCallback(
    (dir) => {
      setCurrent((prev) => stepVisible(prev, dir, visibleIndices, effectiveMode, totalSlides))
    },
    [effectiveMode, totalSlides, visibleIndices],
  )

  const goTo = useCallback(
    (idx) => {
      const resolved = resolveGoTo(idx, effectiveMode, hiddenSet, visibleIndices, totalSlides)
      if (resolved != null) setCurrent(resolved)
    },
    [effectiveMode, totalSlides, hiddenSet, visibleIndices],
  )

  // Keep `current` on a visible slide when in present mode (e.g. after the mode
  // flips while sitting on a hidden slide, or a slide gets hidden under us).
  useEffect(() => {
    const snap = snapToVisible(current, effectiveMode, hiddenSet, visibleIndices, totalSlides)
    if (snap != null) setCurrent(snap)
  }, [effectiveMode, current, hiddenSet, visibleIndices, totalSlides])

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

  /*  🎬 ──────────────────────────────────────────
   *  │  postMessage listener for deck:setMode      │
   *  │  Launcher toggles edit ⇆ present remotely   │
   *  ────────────────────────────────────── 🎬   */

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'deck:setMode' && e.data.project === project) {
        const m = e.data.mode
        if (m === 'edit' || m === 'present') setActiveMode(m)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [project])

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

  const isHidden = useCallback((idx) => hiddenSet.has(idx), [hiddenSet])

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
        // Hide / present-mode surface. `mode` is the *effective* mode so edit
        // affordances vanish and hidden slides hide while fullscreen.
        mode: effectiveMode,
        setMode: setActiveMode,
        hiddenSlides: hidden,
        isHidden,
        visibleIndices,
        visibleCount,
        displayIndex,
        progress,
        atStart,
        atEnd,
        firstVisibleIndex,
        isFullscreen,
      }}
    >
      {children}
      {/* Dev-only, throttled "star us" nudge for local authors. Gated to the
          dev server's edit mode and lazy-loaded, so it never appears in — or is
          even bundled into — a built, presented, or exported deck. */}
      {STAR_PROMPT_DEV && effectiveMode === 'edit' && (
        <Suspense fallback={null}>
          <GitHubStarPrompt editMode />
        </Suspense>
      )}
    </SlideContext.Provider>
  )
}

/*  ┌─────────────────────────────────────────────────────────────┐
 *  │  ◆  H O O K                                                │
 *  └─────────────────────────────────────────────────────────────┘  */

export function useSlides() {
  return useContext(SlideContext)
}
