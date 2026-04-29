/**
 * Editable — local-dev inline text editing primitive (Decision 63 MVP).
 *
 * UX guardrails (Anu, see .squad/decisions/inbox/anu-inline-edit-ux.md and
 * anu-inline-edit-toast.md):
 *   - Activation: plain double-click, plus F2/Enter when focused (a11y).
 *   - Single click never starts editing or steals focus.
 *   - Affordance is dev-only and emitted by `styles/editable.css`. No layout
 *     shift, no persistent badges.
 *   - While editing, navigation shortcuts must not steal arrows / space /
 *     Enter / Escape / Home / End / selection / copy / paste / IME.
 *     We achieve that with `event.stopPropagation()` on every key while
 *     editing — SlideContext's keydown listener is mounted on `document`
 *     and is reached only after React's root delegation, so a stopped
 *     synthetic event is enough.
 *   - Enter saves single-line. Escape cancels and restores. Blur saves
 *     only when content actually changed and validation passes. Shift+Enter
 *     inserts a line break only when `multiline` is set.
 *   - Empty values are rejected unless `allowEmpty` is set. The
 *     "This field can't be empty." validation is field-local because it
 *     blocks editing — it is not a source-save lifecycle event.
 *   - Source-save lifecycle ("Saving…" / "Saved to source" /
 *     "Couldn't save." / "Source changed. Refresh and try again.") is
 *     surfaced by a single dev-only global toast portaled to <body>,
 *     anchored bottom-right with safe-area inset. One status at a time;
 *     rapid saves coalesce. Polite for saving/saved, assertive for
 *     error/conflict. Conflict persists until the next save or dismiss.
 *   - In production / no provider: pure render, no listeners, no
 *     contenteditable attribute, no status UI, no toast DOM.
 *
 * v2 path: this component stays declarative. The endpoint + storage may
 * be swapped for an AST patcher without touching slide JSX.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const InlineEditContext = createContext(null)

function isDevEnv() {
  try {
    return Boolean(import.meta && import.meta.env && import.meta.env.DEV)
  } catch {
    return false
  }
}

// Defensive normalizer: malformed override JSON must fail closed.
// Anything that isn't a plain {string -> string} entry is ignored, the deck
// keeps rendering source defaults, and we never hand a non-string to React
// as text content.
function normalizeOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const key of Object.keys(raw)) {
    const v = raw[key]
    if (typeof key !== 'string' || !key) continue
    if (typeof v !== 'string') continue
    out[key] = v
  }
  return out
}

function defaultInlineEditEndpoint() {
  // Resolve relative to Vite's BASE_URL so decks served behind a sub-path
  // proxy (e.g. the launcher's `/preview/<deckId>/` route) still hit their
  // own Vite middleware. Falls back to the root path in non-Vite envs.
  let base = '/'
  try {
    if (import.meta && import.meta.env && typeof import.meta.env.BASE_URL === 'string') {
      base = import.meta.env.BASE_URL || '/'
    }
  } catch { /* ignore */ }
  if (!base.endsWith('/')) base = `${base}/`
  return `${base}__deckio/inline-edit`
}

// Source-save toast lifecycle timings (ms). Exported for tests.
// Conflict deliberately persists until the next save attempt.
export const TOAST_TIMINGS = Object.freeze({
  saved: 2200,
  error: 6000,
  conflict: 0, // 0 = persist
})

export function InlineEditProvider({
  overrides: initialOverrides = {},
  project,
  endpoint,
  enabled,
  children,
}) {
  const resolvedEndpoint = endpoint || defaultInlineEditEndpoint()
  const [overrides, setOverrides] = useState(() => normalizeOverrides(initialOverrides))
  const hashRef = useRef(null)
  const isDev = useMemo(() => (typeof enabled === 'boolean' ? enabled : isDevEnv()), [enabled])

  // Single global source-save status. Replacement, not stacking.
  const [saveStatus, setSaveStatus] = useState(null)
  const dismissTimerRef = useRef(null)

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])

  const dismissSaveStatus = useCallback(() => {
    clearDismissTimer()
    setSaveStatus(null)
  }, [clearDismissTimer])

  // Cleanup on unmount.
  useEffect(() => () => clearDismissTimer(), [clearDismissTimer])

  const save = useCallback(async (field, value) => {
    if (!isDev) return { ok: false, reason: 'not-dev' }
    // New save attempt clears any persistent (conflict/error) state and
    // shows "Saving…" in the same surface — coalesces rapid edits.
    clearDismissTimer()
    setSaveStatus('saving')
    let res
    try {
      res = await fetch(resolvedEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // v2 readiness: explicit kind discriminator. Server defaults to
          // 'override' but we send it so future 'source-span' clients can
          // share the endpoint without renaming.
          kind: 'override',
          project,
          field,
          value,
          baseHash: hashRef.current || undefined,
        }),
      })
    } catch (err) {
      setSaveStatus('error')
      scheduleAutoDismiss('error')
      return { ok: false, reason: 'network', message: String(err && err.message || err) }
    }
    let body = null
    try { body = await res.json() } catch { /* ignore */ }
    if (res.status === 409) {
      if (body && body.hash) hashRef.current = body.hash
      setSaveStatus('conflict')
      scheduleAutoDismiss('conflict')
      return { ok: false, reason: 'conflict' }
    }
    if (!res.ok) {
      setSaveStatus('error')
      scheduleAutoDismiss('error')
      return { ok: false, reason: `http-${res.status}`, error: body && body.error }
    }
    if (body && body.hash) hashRef.current = body.hash
    setOverrides((prev) => ({ ...prev, [field]: value }))
    setSaveStatus('saved')
    scheduleAutoDismiss('saved')
    return { ok: true }

    function scheduleAutoDismiss(kind) {
      const ms = TOAST_TIMINGS[kind] || 0
      if (!ms) return
      clearDismissTimer()
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null
        setSaveStatus((cur) => (cur === kind ? null : cur))
      }, ms)
    }
  }, [resolvedEndpoint, isDev, project, clearDismissTimer])

  const value = useMemo(
    () => ({ overrides, save, isDev, saveStatus, dismissSaveStatus }),
    [overrides, save, isDev, saveStatus, dismissSaveStatus],
  )

  return (
    <InlineEditContext.Provider value={value}>
      {children}
      {isDev ? <InlineEditToast status={saveStatus} onDismiss={dismissSaveStatus} /> : null}
    </InlineEditContext.Provider>
  )
}

// Back-compat alias. New code should import `InlineEditProvider`.
export const EditableProvider = InlineEditProvider

export function useInlineEdit() {
  return useContext(InlineEditContext)
}

export function useInlineEditValue(field, fallback) {
  const ctx = useContext(InlineEditContext)
  if (!ctx) return fallback
  if (!Object.prototype.hasOwnProperty.call(ctx.overrides, field)) return fallback
  const v = ctx.overrides[field]
  // Defensive: only string overrides are honored. Anything else falls back.
  return typeof v === 'string' ? v : fallback
}

// Back-compat aliases.
export const useEditable = useInlineEdit
export const useEditableValue = useInlineEditValue

// Field-local validation copy. Source-save lifecycle copy lives in
// TOAST_STATUS_TEXT and is rendered by InlineEditToast.
const STATUS_TEXT = {
  empty: 'This field can’t be empty.',
}

export const TOAST_STATUS_TEXT = Object.freeze({
  saving: 'Saving…',
  saved: 'Saved to source',
  error: 'Couldn’t save.',
  conflict: 'Source changed. Refresh and try again.',
})

// Dev-only global save-status toast. Portals to <body> so it never
// participates in slide layout, never shifts content, and survives
// being mounted inside an iframe (the launcher preview proxy). Anchored
// bottom-right with safe-area inset; CSS handles reduced-motion.
function InlineEditToastIcon({ status }) {
  // Each status has a distinct shape so the surface is identifiable by
  // icon + text + color (Anu acceptance: don't rely on color alone).
  // currentColor inherits from the per-status text color → contrast safe.
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  }
  if (status === 'saving') {
    // Quarter-arc spinner; spin animation is CSS, disabled by reduced-motion.
    return (
      <svg {...common} className="deckio-inline-edit-toast__icon deckio-inline-edit-toast__icon--spin">
        <path d="M14 8a6 6 0 1 1-6-6" />
      </svg>
    )
  }
  if (status === 'saved') {
    return (
      <svg {...common} className="deckio-inline-edit-toast__icon">
        <path d="M3.5 8.5l3 3 6-7" />
      </svg>
    )
  }
  if (status === 'error') {
    // Filled triangle with exclamation — universally read as warning.
    return (
      <svg {...common} className="deckio-inline-edit-toast__icon">
        <path d="M8 2.5L14.5 13.5h-13z" />
        <path d="M8 7v3" />
        <path d="M8 12.25v.01" />
      </svg>
    )
  }
  if (status === 'conflict') {
    // Circular refresh-style glyph — distinct from the error triangle so
    // a sighted user can tell error from conflict at a glance.
    return (
      <svg {...common} className="deckio-inline-edit-toast__icon">
        <path d="M13.5 4.5v3h-3" />
        <path d="M2.8 9.5A5.5 5.5 0 0 0 13 11" />
        <path d="M2.5 11.5v-3h3" />
        <path d="M13.2 6.5A5.5 5.5 0 0 0 3 5" />
      </svg>
    )
  }
  return null
}

function InlineEditToast({ status, onDismiss }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null
  if (typeof document === 'undefined' || !document.body) return null

  const text = status ? TOAST_STATUS_TEXT[status] : null
  const isAlert = status === 'error' || status === 'conflict'
  // Always render the live region container so screen readers hear
  // updates; the visible chip only renders when there is a status.
  const node = (
    <div
      className="deckio-inline-edit-toast-root"
      data-deckio-toast-root=""
      // Defense-in-depth for the export pipeline: even though the
      // provider is gated on `isDev` and exporters screenshot slide
      // nodes (not <body>), tag the root so any future full-page
      // capture path (modern-screenshot, html2canvas, puppeteer) can
      // skip it without coupling to internal class names.
      data-html2canvas-ignore="true"
      data-deckio-export-ignore="true"
      // Single global aria-live region. Polite for routine save lifecycle,
      // assertive (role="alert") for errors and source conflicts.
      aria-live={isAlert ? 'assertive' : 'polite'}
      role={isAlert ? 'alert' : 'status'}
    >
      {text ? (
        <div
          className={`deckio-inline-edit-toast deckio-inline-edit-toast--${status}`}
          data-deckio-toast-status={status}
        >
          <InlineEditToastIcon status={status} />
          <span className="deckio-inline-edit-toast__text">{text}</span>
          {status === 'conflict' || status === 'error' ? (
            <button
              type="button"
              className="deckio-inline-edit-toast__dismiss"
              onClick={onDismiss}
              aria-label="Dismiss save status"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
  return createPortal(node, document.body)
}

function placeCaretAtEnd(node) {
  try {
    node.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } catch { /* ignore */ }
}

const Editable = forwardRef(function Editable(
  {
    id,
    field: fieldProp,
    as: Tag = 'span',
    children,
    fallback,
    className,
    multiline = false,
    allowEmpty = false,
    label,
    onClick,
    onDoubleClick,
    onKeyDown,
    ...rest
  },
  externalRef,
) {
  // `id` is the documented Messi-spec prop; `field` is kept as a back-compat
  // alias so MVP-era call sites keep working. We never forward either to the
  // host DOM element so HTML `id` collisions can't happen.
  const field = typeof id === 'string' && id ? id : fieldProp
  const ctx = useContext(InlineEditContext)
  const localRef = useRef(null)
  const ref = externalRef || localRef
  const [editing, setEditing] = useState(false)
  // Field-local status only carries blocking validation (e.g. empty).
  // Source-save lifecycle (saving/saved/error/conflict) is owned by the
  // provider's global toast; field UI must not jump next to whichever
  // field happens to be edited.
  const [status, setStatus] = useState(null)

  const hasOverride = ctx && Object.prototype.hasOwnProperty.call(ctx.overrides || {}, field)
  // Defensive: treat non-string overrides as missing (fail closed).
  const overrideValue = hasOverride && typeof ctx.overrides[field] === 'string'
    ? ctx.overrides[field]
    : null
  const defaultContent = children == null ? fallback : children
  const display = overrideValue != null ? overrideValue : defaultContent
  const displayString = display == null ? '' : (typeof display === 'string' ? display : '')

  // Inert path: production, no provider, or provider explicitly disabled.
  // Important: do NOT emit a `contenteditable` attribute at all here, so
  // SlideContext's `[contenteditable]` selector cannot match by accident
  // and steal nav keys. Also no field data attribute, no edit affordance.
  if (!ctx || !ctx.isDev) {
    return (
      <Tag ref={ref} className={className} {...rest}>
        {display}
      </Tag>
    )
  }

  const beginEdit = () => {
    if (editing) return
    setEditing(true)
    setStatus(null)
    setTimeout(() => {
      const node = ref && 'current' in ref ? ref.current : null
      if (node) placeCaretAtEnd(node)
    }, 0)
  }

  const cancel = () => {
    if (!editing) return
    const node = ref && 'current' in ref ? ref.current : null
    if (node) {
      node.innerText = displayString
    }
    setEditing(false)
    setStatus(null)
    setTimeout(() => {
      if (node) node.focus({ preventScroll: true })
    }, 0)
  }

  const commit = async () => {
    if (!editing) return
    const node = ref && 'current' in ref ? ref.current : null
    if (!node) return
    const raw = node.innerText == null ? (node.textContent || '') : node.innerText
    const newValue = multiline ? raw.replace(/\r\n/g, '\n') : raw.replace(/[\r\n]+/g, ' ').trim()
    const oldValue = displayString

    if (newValue === oldValue) {
      setEditing(false)
      setStatus(null)
      return
    }
    if (!allowEmpty && newValue.length === 0) {
      // Field-local because it is a blocking validation, not a save event.
      setStatus('empty')
      placeCaretAtEnd(node)
      return
    }

    // Clear any field-local validation; source-save feedback now lives in
    // the global toast surface owned by the provider.
    setStatus(null)
    const result = await ctx.save(field, newValue)
    setEditing(false)
    if (!(result && result.ok)) {
      // Restore prior value on failure or conflict so the field never
      // shows an unsaved local edit; the user is told why via the toast.
      if (node) node.innerText = oldValue
    }
    setTimeout(() => {
      if (node) node.focus({ preventScroll: true })
    }, 0)
  }

  const handleClick = (event) => {
    if (onClick) onClick(event)
    // Single click intentionally does nothing edit-related: keep slide UX intact.
  }

  const handleDoubleClick = (event) => {
    if (onDoubleClick) onDoubleClick(event)
    if (event.defaultPrevented) return
    event.stopPropagation()
    beginEdit()
  }

  const handleKeyDown = (event) => {
    if (onKeyDown) onKeyDown(event)
    if (event.defaultPrevented) return

    if (!editing) {
      if (event.key === 'F2' || event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        beginEdit()
      }
      return
    }

    // Editing: stop every key from reaching SlideContext's document-level
    // nav handler. React 19 root delegation runs before document handlers,
    // so a stopped synthetic event is sufficient.
    event.stopPropagation()

    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter') {
      if (multiline && event.shiftKey) {
        return
      }
      if (!multiline && event.shiftKey) {
        event.preventDefault()
        return
      }
      event.preventDefault()
      void commit()
    }
  }

  const handleBlur = () => {
    if (!editing) return
    void commit()
  }

  const composedClassName = [
    className,
    'deckio-editable',
    editing && 'deckio-editable--active',
    status === 'empty' && 'deckio-editable--error',
  ].filter(Boolean).join(' ')

  const accessibleLabel = label || `Editable text${field ? `, ${field}` : ''}. Press Enter or F2 to edit, or double-click.`
  const statusText = status ? STATUS_TEXT[status] || null : null

  const editingProps = editing
    ? { contentEditable: true, suppressContentEditableWarning: true, spellCheck: true, role: 'textbox', 'aria-multiline': multiline ? 'true' : 'false' }
    : { tabIndex: 0, role: 'button' }

  return (
    <>
      <Tag
        ref={ref}
        className={composedClassName}
        data-deckio-field={field}
        data-deckio-multiline={multiline ? 'true' : undefined}
        aria-label={accessibleLabel}
        title={editing ? undefined : 'Double-click to edit'}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...editingProps}
        {...rest}
      >
        {display}
      </Tag>
      {/* Field-local status only renders for blocking validation
          (e.g. empty-not-allowed). Source-save lifecycle is global. */}
      {statusText ? (
        <span
          className="deckio-editable-status"
          role="status"
          aria-live="assertive"
        >
          {statusText}
        </span>
      ) : null}
    </>
  )
})

export default Editable
