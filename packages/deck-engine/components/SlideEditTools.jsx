/**
 * SlideEditTools — dev-only hide + delete controls for the active slide.
 *
 * Rendered inside <Navigation>'s export group (top-right, beside the export
 * button) so it shares the chrome's reveal-on-mouse-move / hide-on-idle
 * behaviour and never overlaps anything. Only renders when inline editing is
 * enabled (InlineEditProvider present + isDev) AND the deck is in edit mode —
 * inert in production, during presentation, and in fullscreen.
 *
 * Operations go through the deterministic slide-op endpoint (callSlideOp),
 * which edits deck.config.js. The resulting file write triggers a Vite reload,
 * so there is no optimistic local state to keep in sync — the reload reflects
 * the new hiddenSlides / slides array.
 *
 * The buttons take their visual style from the host (Navigation passes its
 * export-button classes) so they sit flush in the group. Both are tagged so
 * the export/capture pipeline (modern-screenshot, html2canvas, puppeteer)
 * skips them.
 */
import { useState, useEffect, useRef } from 'react'
import { useSlides } from '../context/SlideContext'
import { useInlineEdit } from './Editable.jsx'
import { callSlideOp } from './slide-op-client.js'

const IGNORE_ATTRS = {
  'data-deckio-export-ignore': 'true',
  'data-html2canvas-ignore': 'true',
}

export default function SlideEditTools({
  buttonClassName = 'deckio-slide-tools__btn',
  activeClassName = 'is-hidden-slide',
  dangerClassName = 'deckio-slide-tools__btn--danger',
}) {
  const slides = useSlides()
  const ie = useInlineEdit()
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState(null)
  const confirmTimer = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  // Gate: only when inline editing is active (middleware mounted) and editing.
  if (!ie || !ie.isDev) return null
  if (!slides || slides.mode !== 'edit') return null

  const { current, totalSlides, isHidden } = slides
  const hidden = typeof isHidden === 'function' ? isHidden(current) : false

  async function runOp(body, label) {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await callSlideOp(body)
    if (!result.ok) {
      setBusy(false)
      setError(result.data?.code || `${label} failed`)
      return
    }
    // Success: deck.config.js changed → Vite will reload. Keep the buttons
    // disabled until that happens so a second click can't race the reload.
  }

  function toggleHide() {
    runOp({ op: 'hide', index: current, hidden: !hidden, total: totalSlides }, 'Hide')
  }

  function requestDelete() {
    if (confirmingDelete) {
      clearTimeout(confirmTimer.current)
      setConfirmingDelete(false)
      runOp({ op: 'delete', index: current, total: totalSlides }, 'Delete')
      return
    }
    setConfirmingDelete(true)
    confirmTimer.current = setTimeout(() => setConfirmingDelete(false), 3000)
  }

  const hideTitle = error
    ? `Hide failed: ${error}`
    : hidden
      ? 'Show this slide in presentation'
      : 'Hide this slide from presentation'

  return (
    <>
      <button
        type="button"
        className={`${buttonClassName} ${hidden ? activeClassName : ''}`}
        onClick={toggleHide}
        disabled={busy}
        title={hideTitle}
        aria-label={hidden ? 'Show slide' : 'Hide slide'}
        {...IGNORE_ATTRS}
      >
        {hidden ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>

      <button
        type="button"
        className={`${buttonClassName} ${confirmingDelete ? dangerClassName : ''}`}
        onClick={requestDelete}
        disabled={busy}
        title={confirmingDelete ? 'Click again to delete this slide' : 'Delete this slide'}
        aria-label={confirmingDelete ? 'Confirm delete slide' : 'Delete slide'}
        {...IGNORE_ATTRS}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </>
  )
}
