/**
 * EditableToolbar — floating dev-only style toolbar for the active <Editable>.
 *
 * Anu UX guardrails (anu-inline-edit-style-toolbar.md):
 *   - One toolbar at a time, anchored above the active field.
 *   - Theme tokens shown first ("Theme" row); free hex picker is behind
 *     an "Advanced" disclosure so non-designers can't paint themselves
 *     into a contrast hole.
 *   - Mouse interaction inside the toolbar must NOT blur the
 *     contentEditable. Achieved via `data-deckio-toolbar-root` and the
 *     Editable's blur handler checking `relatedTarget.closest(...)`.
 *   - Hidden by default; appears only when `ctx.activeField` is set.
 *   - Tagged `data-deckio-export-ignore="true"` so PDF/PNG export skips it.
 *   - No persistent badge in source; pure runtime UI.
 *
 * Positioning:
 *   ResizeObserver on the anchor + window scroll/resize listeners. The
 *   toolbar floats above the anchor by default; if there isn't enough
 *   space above, it flips below. Horizontally clamped to the viewport.
 *
 * Persistence:
 *   Calls `ctx.save(field, { style: {...} })`. The server merges the new
 *   facets onto the existing entry (preserves value, preserves other
 *   style keys we didn't touch). Toolbar never sends a `value` patch.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { InlineEditContext } from './editable-context.js'

// Theme tokens shown first — these resolve via CSS vars to whatever the
// deck's active theme defines. Free-hex is gated behind Advanced so users
// don't break their theme by accident.
const THEME_COLOR_SWATCHES = [
  { value: 'var(--accent)',     label: 'Accent' },
  { value: 'var(--accent-2)',   label: 'Accent 2' },
  { value: 'var(--foreground)', label: 'Foreground' },
  { value: 'var(--muted)',      label: 'Muted' },
  { value: 'var(--background)', label: 'Background' },
]

const FONT_FAMILY_OPTIONS = [
  { value: '',                         label: 'Default' },
  { value: 'var(--font-sans)',         label: 'Theme sans' },
  { value: 'var(--font-serif)',        label: 'Theme serif' },
  { value: 'var(--font-mono)',         label: 'Theme mono' },
  { value: 'var(--font-display)',      label: 'Theme display' },
  { value: 'Inter',                    label: 'Inter' },
  { value: 'system-ui',                label: 'System' },
  { value: 'serif',                    label: 'Serif' },
  { value: 'sans-serif',               label: 'Sans-serif' },
  { value: 'monospace',                label: 'Mono' },
]

const FONT_SIZE_STEPS = ['0.75rem', '0.875rem', '1rem', '1.125rem', '1.25rem', '1.5rem', '1.875rem', '2.25rem', '3rem', '3.75rem', '4.5rem']

const TEXT_ALIGN_OPTIONS = [
  { value: 'left',    label: 'Align left',    icon: 'L' },
  { value: 'center',  label: 'Align center',  icon: 'C' },
  { value: 'right',   label: 'Align right',   icon: 'R' },
]

const TOOLBAR_OFFSET = 10   // px gap between toolbar and anchor
const TOOLBAR_MIN_MARGIN = 6 // px from viewport edge

// Read an entry's style facet defensively. Used to seed toolbar initial
// state; not authoritative.
function readEntryStyle(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (Object.prototype.hasOwnProperty.call(entry, 'order')) return null
  return (entry.style && typeof entry.style === 'object') ? entry.style : null
}

function parseSizeStepIndex(value) {
  if (!value) return -1
  const idx = FONT_SIZE_STEPS.indexOf(value)
  return idx
}

function nextSize(current, dir) {
  if (!current) return dir > 0 ? FONT_SIZE_STEPS[3] : FONT_SIZE_STEPS[2]
  const i = parseSizeStepIndex(current)
  if (i < 0) {
    // Custom value — snap to nearest step in the requested direction.
    return dir > 0 ? FONT_SIZE_STEPS[3] : FONT_SIZE_STEPS[2]
  }
  const next = Math.max(0, Math.min(FONT_SIZE_STEPS.length - 1, i + dir))
  return FONT_SIZE_STEPS[next]
}

function isHexColor(s) {
  return typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s.trim())
}

export default function EditableToolbar() {
  const ctx = useContext(InlineEditContext)
  const rootRef = useRef(null)
  const [pos, setPos] = useState(null)
  const [advanced, setAdvanced] = useState(false)
  const [pendingFreeHex, setPendingFreeHex] = useState('')

  const activeField = ctx && ctx.activeField
  const activeElement = ctx && ctx.activeElementRef ? ctx.activeElementRef.current : null

  // Re-read the live entry on every render so the toolbar reflects the
  // current style after a save round-trip.
  const entryStyle = useMemo(() => {
    if (!ctx || !activeField) return null
    return readEntryStyle(ctx.overrides && ctx.overrides[activeField])
  }, [ctx, activeField])

  const reposition = useCallback(() => {
    if (!activeElement || !rootRef.current) return
    const anchorRect = activeElement.getBoundingClientRect()
    const root = rootRef.current
    // Use offsetHeight/Width so we don't depend on bounding-rect quirks
    // before paint.
    const tw = root.offsetWidth || 240
    const th = root.offsetHeight || 36

    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    // Prefer above; flip below if not enough room.
    let top = anchorRect.top - th - TOOLBAR_OFFSET
    if (top < TOOLBAR_MIN_MARGIN) {
      const below = anchorRect.bottom + TOOLBAR_OFFSET
      if (below + th + TOOLBAR_MIN_MARGIN <= viewportH) {
        top = below
      } else {
        // Pin to top margin as a last resort.
        top = TOOLBAR_MIN_MARGIN
      }
    }

    // Horizontal: center on anchor, clamped to viewport.
    let left = anchorRect.left + (anchorRect.width / 2) - (tw / 2)
    if (left < TOOLBAR_MIN_MARGIN) left = TOOLBAR_MIN_MARGIN
    if (left + tw + TOOLBAR_MIN_MARGIN > viewportW) {
      left = viewportW - tw - TOOLBAR_MIN_MARGIN
    }

    setPos({ top: Math.round(top), left: Math.round(left) })
  }, [activeElement])

  // Subscribe to the anchor's size + scroll/resize so the toolbar
  // follows it. We rebuild observers when the anchor changes.
  useEffect(() => {
    if (!activeElement) {
      setPos(null)
      return undefined
    }
    reposition()
    const onScroll = () => reposition()
    const onResize = () => reposition()
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => reposition())
      ro.observe(activeElement)
      if (rootRef.current) ro.observe(rootRef.current)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [activeElement, reposition])

  // Reset advanced + pending hex when the active field flips.
  useEffect(() => {
    setAdvanced(false)
    setPendingFreeHex('')
  }, [activeField])

  if (!ctx || !ctx.isDev || !activeField || !activeElement) return null
  if (typeof document === 'undefined' || !document.body) return null

  const patchStyle = async (mutation) => {
    const current = (entryStyle && typeof entryStyle === 'object') ? entryStyle : {}
    const nextStyle = { ...current, ...mutation }
    // Strip empty values so we don't store noise.
    for (const k of Object.keys(nextStyle)) {
      if (nextStyle[k] == null || nextStyle[k] === '') delete nextStyle[k]
    }
    await ctx.save(activeField, { style: nextStyle })
  }

  const currentFont = (entryStyle && entryStyle.fontFamily) || ''
  const currentSize = (entryStyle && entryStyle.fontSize) || ''
  const currentColor = (entryStyle && entryStyle.color) || ''
  const currentWeight = (entryStyle && entryStyle.fontWeight) || ''
  const currentStyleAttr = (entryStyle && entryStyle.fontStyle) || ''
  const currentAlign = (entryStyle && entryStyle.textAlign) || ''

  const isBold = currentWeight === 'bold' || currentWeight === 700 || currentWeight === '700'
  const isItalic = currentStyleAttr === 'italic'

  const node = (
    <div
      ref={rootRef}
      className="deckio-editable-toolbar"
      data-deckio-toolbar-root=""
      data-deckio-export-ignore="true"
      data-html2canvas-ignore="true"
      role="toolbar"
      aria-label="Text style"
      style={pos
        ? { position: 'fixed', top: pos.top, left: pos.left, visibility: 'visible' }
        : { position: 'fixed', top: -9999, left: -9999, visibility: 'hidden' }}
      // Belt-and-suspenders: prevent focus from leaving the contenteditable
      // when the user clicks toolbar chrome (buttons handle their own
      // focus afterwards).
      onMouseDown={(e) => {
        // Only preventDefault on non-form-control descendants so native
        // <select>/<input type=color> still get focus and emit events.
        const t = e.target
        if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
        e.preventDefault()
      }}
    >
      <select
        className="deckio-editable-toolbar__select"
        aria-label="Font family"
        value={currentFont}
        onChange={(e) => { void patchStyle({ fontFamily: e.target.value || undefined }) }}
      >
        {FONT_FAMILY_OPTIONS.map((opt) => (
          <option key={opt.value || '__default'} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <div className="deckio-editable-toolbar__group" role="group" aria-label="Font size">
        <button
          type="button"
          className="deckio-editable-toolbar__btn"
          aria-label="Decrease size"
          onClick={() => { void patchStyle({ fontSize: nextSize(currentSize, -1) }) }}
        >A−</button>
        <span className="deckio-editable-toolbar__readout" title={currentSize || 'Default'}>
          {currentSize || '—'}
        </span>
        <button
          type="button"
          className="deckio-editable-toolbar__btn"
          aria-label="Increase size"
          onClick={() => { void patchStyle({ fontSize: nextSize(currentSize, +1) }) }}
        >A+</button>
      </div>

      <div className="deckio-editable-toolbar__group" role="group" aria-label="Text formatting">
        <button
          type="button"
          className={`deckio-editable-toolbar__btn ${isBold ? 'is-active' : ''}`}
          aria-pressed={isBold ? 'true' : 'false'}
          aria-label="Bold"
          onClick={() => { void patchStyle({ fontWeight: isBold ? undefined : 'bold' }) }}
        ><b>B</b></button>
        <button
          type="button"
          className={`deckio-editable-toolbar__btn ${isItalic ? 'is-active' : ''}`}
          aria-pressed={isItalic ? 'true' : 'false'}
          aria-label="Italic"
          onClick={() => { void patchStyle({ fontStyle: isItalic ? undefined : 'italic' }) }}
        ><i>I</i></button>
      </div>

      <div className="deckio-editable-toolbar__group" role="group" aria-label="Text align">
        {TEXT_ALIGN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`deckio-editable-toolbar__btn ${currentAlign === opt.value ? 'is-active' : ''}`}
            aria-pressed={currentAlign === opt.value ? 'true' : 'false'}
            aria-label={opt.label}
            onClick={() => { void patchStyle({ textAlign: currentAlign === opt.value ? undefined : opt.value }) }}
          >{opt.icon}</button>
        ))}
      </div>

      <div className="deckio-editable-toolbar__group deckio-editable-toolbar__swatches" role="group" aria-label="Color">
        {THEME_COLOR_SWATCHES.map((sw) => {
          const active = currentColor === sw.value
          return (
            <button
              key={sw.value}
              type="button"
              className={`deckio-editable-toolbar__swatch ${active ? 'is-active' : ''}`}
              aria-pressed={active ? 'true' : 'false'}
              aria-label={`Color ${sw.label}`}
              title={sw.label}
              style={{ background: sw.value }}
              onClick={() => { void patchStyle({ color: active ? undefined : sw.value }) }}
            />
          )
        })}
        {currentColor ? (
          <button
            type="button"
            className="deckio-editable-toolbar__btn"
            aria-label="Clear color"
            title="Clear color"
            onClick={() => { void patchStyle({ color: undefined }) }}
          >×</button>
        ) : null}
      </div>

      <button
        type="button"
        className={`deckio-editable-toolbar__btn deckio-editable-toolbar__advanced ${advanced ? 'is-active' : ''}`}
        aria-expanded={advanced ? 'true' : 'false'}
        aria-label="Advanced"
        onClick={() => setAdvanced((v) => !v)}
      >…</button>

      {advanced ? (
        <div className="deckio-editable-toolbar__advanced-panel" role="group" aria-label="Advanced color">
          <input
            type="color"
            className="deckio-editable-toolbar__colorpicker"
            aria-label="Custom color"
            value={isHexColor(currentColor) ? currentColor : '#ffffff'}
            onChange={(e) => { void patchStyle({ color: e.target.value }) }}
          />
          <input
            type="text"
            className="deckio-editable-toolbar__hexinput"
            aria-label="Custom hex"
            placeholder="#hex"
            value={pendingFreeHex}
            onChange={(e) => setPendingFreeHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (isHexColor(pendingFreeHex)) {
                  void patchStyle({ color: pendingFreeHex.trim() })
                }
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )

  return createPortal(node, document.body)
}
