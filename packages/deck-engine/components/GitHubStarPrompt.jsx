import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './GitHubStarPrompt.module.css'
import {
  evaluateForSession,
  markShown,
  markStarred,
  markSnoozed,
  markDismissed,
} from './star-prompt-store.js'

const REPO_URL = 'https://github.com/deckio-art/deck-engine'

function getStorage(name) {
  try {
    return window[name] || null
  } catch {
    return null
  }
}

/**
 * Are we in a context where it's appropriate to nudge a local author?
 *
 * Strictly gated so the prompt can NEVER leak into a built, presented, or
 * exported deck:
 *   - `editMode` — only while authoring (never in present/fullscreen).
 *   - `import.meta.env.DEV` — only on the vite dev server, never in a build.
 *   - top window only — inside the DECKIO workspace iframe the launcher shows
 *     its own prompt, so we suppress here to avoid double-asking.
 *   - never while a PDF/PPTX capture is running (`data-export-mode="capture"`).
 */
function isAuthoringContext(editMode) {
  if (!editMode) return false
  let dev = false
  try {
    dev = Boolean(import.meta && import.meta.env && import.meta.env.DEV)
  } catch {
    dev = false
  }
  if (!dev) return false
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    if (window.top !== window.self) return false
  } catch {
    return false // cross-origin frame access → treat as embedded, stay quiet
  }
  try {
    if (document.documentElement.getAttribute('data-export-mode') === 'capture') return false
  } catch {
    /* ignore */
  }
  return true
}

/**
 * A small, dismissable corner card inviting engaged local authors to star the
 * deck-engine repo. Auto-mounted by SlideProvider so offline npm-package users
 * see it without changing their deck — but only while editing on the dev
 * server. Non-modal, throttled, persisted (see star-prompt-store.js).
 */
export default function GitHubStarPrompt({ editMode = false }) {
  const [visible, setVisible] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!isAuthoringContext(editMode)) return
    const local = getStorage('localStorage')
    const session = getStorage('sessionStorage')
    if (!local || !session) return
    if (evaluateForSession(local, session)) {
      markShown(local)
      setVisible(true)
    }
  }, [editMode])

  useEffect(() => {
    if (!visible) return
    cardRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') snooze()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible || typeof document === 'undefined') return null

  const snooze = () => {
    const local = getStorage('localStorage')
    if (local) markSnoozed(local)
    setVisible(false)
  }

  const star = () => {
    const local = getStorage('localStorage')
    if (local) markStarred(local)
    try {
      window.open(REPO_URL, '_blank', 'noopener,noreferrer')
    } catch {
      /* popup blocked — state already recorded */
    }
    setVisible(false)
  }

  const never = () => {
    const local = getStorage('localStorage')
    if (local) markDismissed(local)
    setVisible(false)
  }

  return createPortal(
    <div
      ref={cardRef}
      className={styles.root}
      role="dialog"
      aria-label="Support DeckIO on GitHub"
      tabIndex={-1}
    >
      <button className={styles.close} onClick={snooze} aria-label="Dismiss">
        <CloseIcon />
      </button>

      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          <StarIcon />
        </span>
        <div className={styles.text}>
          <strong className={styles.title}>Enjoying DeckIO?</strong>
          <span className={styles.sub}>
            Give <code className={styles.repo}>deck-engine</code> a star on GitHub to support the project.
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.primary} onClick={star}>
          <StarIcon small />
          Star on GitHub
        </button>
        <button className={styles.secondary} onClick={snooze}>
          Maybe later
        </button>
      </div>

      <button className={styles.never} onClick={never}>
        Don&rsquo;t show again
      </button>
    </div>,
    document.body,
  )
}

function StarIcon({ small = false }) {
  const s = small ? 14 : 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.77l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
