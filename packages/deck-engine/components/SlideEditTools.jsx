/**
 * SlideEditTools — dev-only in-deck overlay for hide + delete on the active
 * slide. Rendered by <Slide> for the active slide only, and only when inline
 * editing is enabled (InlineEditProvider present + isDev) AND the deck is in
 * edit mode. Inert in production builds and during presentation.
 *
 * Operations go through the deterministic slide-op endpoint (callSlideOp),
 * which edits deck.config.js. The resulting file write triggers a Vite reload,
 * so there is no optimistic local state to keep in sync — the reload reflects
 * the new hiddenSlides / slides array.
 *
 * Both buttons are tagged so the export/capture pipeline (modern-screenshot,
 * html2canvas, puppeteer) skips them.
 */
import { useState, useEffect, useRef } from 'react'
import { useSlides } from '../context/SlideContext'
import { useInlineEdit } from './Editable.jsx'
import { callSlideOp } from './slide-op-client.js'

const IGNORE_ATTRS = {
  'data-deckio-export-ignore': 'true',
  'data-html2canvas-ignore': 'true',
}

export default function SlideEditTools() {
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

  return (
    <div className="deckio-slide-tools" {...IGNORE_ATTRS} contentEditable={false}>
      <button
        type="button"
        className={`deckio-slide-tools__btn ${hidden ? 'is-hidden-slide' : ''}`}
        onClick={toggleHide}
        disabled={busy}
        title={hidden ? 'Show this slide in presentation' : 'Hide this slide from presentation'}
        aria-label={hidden ? 'Show slide' : 'Hide slide'}
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
        className={`deckio-slide-tools__btn deckio-slide-tools__btn--danger ${confirmingDelete ? 'is-confirming' : ''}`}
        onClick={requestDelete}
        disabled={busy}
        title={confirmingDelete ? 'Click again to delete this slide' : 'Delete this slide'}
        aria-label={confirmingDelete ? 'Confirm delete slide' : 'Delete slide'}
      >
        {confirmingDelete ? (
          <span className="deckio-slide-tools__confirm">Delete?</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </button>

      {hidden && <span className="deckio-slide-tools__badge">Hidden</span>}
      {error && <span className="deckio-slide-tools__error" role="alert">{error}</span>}
    </div>
  )
}
