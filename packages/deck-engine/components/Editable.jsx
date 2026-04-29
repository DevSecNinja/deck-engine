/**
 * Editable — local-dev inline text editing primitive (Decision 63 MVP).
 *
 * UX guardrails (Anu, see .squad/decisions/inbox/anu-inline-edit-ux.md):
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
 *   - Empty values are rejected unless `allowEmpty` is set.
 *   - Status surface uses an aria-live="polite" region: "Saving…",
 *     "Saved to source", "Couldn’t save.", "Source changed. Refresh and try again."
 *   - In production / no provider: pure render, no listeners, no
 *     contenteditable attribute, no status UI.
 *
 * v2 path: this component stays declarative. The endpoint + storage may
 * be swapped for an AST patcher without touching slide JSX.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

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

export function InlineEditProvider({
  overrides: initialOverrides = {},
  project,
  endpoint = '/__deckio/inline-edit',
  enabled,
  children,
}) {
  const [overrides, setOverrides] = useState(() => normalizeOverrides(initialOverrides))
  const hashRef = useRef(null)
  const isDev = useMemo(() => (typeof enabled === 'boolean' ? enabled : isDevEnv()), [enabled])

  const save = useCallback(async (field, value) => {
    if (!isDev) return { ok: false, reason: 'not-dev' }
    let res
    try {
      res = await fetch(endpoint, {
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
      return { ok: false, reason: 'network', message: String(err && err.message || err) }
    }
    let body = null
    try { body = await res.json() } catch { /* ignore */ }
    if (res.status === 409) {
      if (body && body.hash) hashRef.current = body.hash
      return { ok: false, reason: 'conflict' }
    }
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}`, error: body && body.error }
    }
    if (body && body.hash) hashRef.current = body.hash
    setOverrides((prev) => ({ ...prev, [field]: value }))
    return { ok: true }
  }, [endpoint, isDev, project])

  const value = useMemo(() => ({ overrides, save, isDev }), [overrides, save, isDev])

  return (
    <InlineEditContext.Provider value={value}>
      {children}
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

const STATUS_TEXT = {
  saving: 'Saving…',
  saved: 'Saved to source',
  error: 'Couldn’t save.',
  conflict: 'Source changed. Refresh and try again.',
  empty: 'This field can’t be empty.',
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
  const [status, setStatus] = useState(null)
  const savedTimerRef = useRef(null)

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

  const flushSavedAfter = (ms = 1200) => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setStatus((s) => (s === 'saved' ? null : s)), ms)
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
      setStatus('empty')
      placeCaretAtEnd(node)
      return
    }

    setStatus('saving')
    const result = await ctx.save(field, newValue)
    setEditing(false)
    if (result && result.ok) {
      setStatus('saved')
      flushSavedAfter()
    } else if (result && result.reason === 'conflict') {
      setStatus('conflict')
      if (node) node.innerText = oldValue
    } else {
      setStatus('error')
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
    status === 'error' && 'deckio-editable--error',
    status === 'conflict' && 'deckio-editable--error',
    status === 'empty' && 'deckio-editable--error',
    status === 'saving' && 'deckio-editable--saving',
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
      <span
        className="deckio-editable-status"
        role="status"
        aria-live={status === 'empty' || status === 'error' || status === 'conflict' ? 'assertive' : 'polite'}
      >
        {statusText}
      </span>
    </>
  )
})

export default Editable
