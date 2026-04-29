/**
 * Editable — local-dev inline text editing primitive (Decision 63 MVP).
 *
 * Usage in slide JSX:
 *
 *   <Editable field="cover.title" as="h1">Default Title</Editable>
 *
 * In dev (Vite): double-click activates contentEditable. On blur, the new
 * value is sent to POST /__deckio/inline-edit and persisted to
 * src/data/inline-edits.json. The local override map is updated so the
 * change is visible immediately without a page reload.
 *
 * In production builds (or when no <EditableProvider> is mounted), the
 * component is inert — it simply renders the override (if one was bundled)
 * or the original children, with no listeners and no writable surface.
 *
 * v2 path: keep this component purely declarative. The endpoint and
 * storage layer can be swapped to AST/source-span patching without
 * touching slide JSX.
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

const EditableContext = createContext(null)

function isDevEnv() {
  try {
    return Boolean(import.meta && import.meta.env && import.meta.env.DEV)
  } catch {
    return false
  }
}

export function EditableProvider({
  overrides: initialOverrides = {},
  project,
  endpoint = '/__deckio/inline-edit',
  enabled,
  children,
}) {
  const [overrides, setOverrides] = useState(() => ({ ...(initialOverrides || {}) }))
  const isDev = useMemo(() => (typeof enabled === 'boolean' ? enabled : isDevEnv()), [enabled])

  const save = useCallback(async (field, value) => {
    setOverrides((prev) => ({ ...prev, [field]: value }))
    if (!isDev) return { ok: false, reason: 'not-dev' }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project, field, value }),
      })
      if (!res.ok) {
        return { ok: false, reason: `http-${res.status}` }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: String(err && err.message || err) }
    }
  }, [endpoint, isDev, project])

  const value = useMemo(() => ({ overrides, save, isDev }), [overrides, save, isDev])

  return (
    <EditableContext.Provider value={value}>
      {children}
    </EditableContext.Provider>
  )
}

export function useEditable() {
  return useContext(EditableContext)
}

export function useEditableValue(field, fallback) {
  const ctx = useContext(EditableContext)
  if (!ctx) return fallback
  return Object.prototype.hasOwnProperty.call(ctx.overrides, field)
    ? ctx.overrides[field]
    : fallback
}

const Editable = forwardRef(function Editable(
  {
    field,
    as: Tag = 'span',
    children,
    className,
    onClick,
    onDoubleClick,
    ...rest
  },
  externalRef,
) {
  const ctx = useContext(EditableContext)
  const localRef = useRef(null)
  const ref = externalRef || localRef
  const [editing, setEditing] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)

  const hasOverride = ctx && Object.prototype.hasOwnProperty.call(ctx.overrides || {}, field)
  const overrideValue = hasOverride ? ctx.overrides[field] : null
  const display = hasOverride ? overrideValue : children

  // Inert path: production, no provider, or provider explicitly disabled.
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
    setSaveStatus(null)
    // Defer focus + caret placement to after the contentEditable attr lands.
    setTimeout(() => {
      const node = ref && 'current' in ref ? ref.current : null
      if (!node) return
      try {
        node.focus()
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(false)
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(range)
        }
      } catch { /* ignore */ }
    }, 0)
  }

  const handleDoubleClick = (event) => {
    if (onDoubleClick) onDoubleClick(event)
    if (event.defaultPrevented) return
    event.stopPropagation()
    beginEdit()
  }

  const finish = async (commit) => {
    if (!editing) return
    setEditing(false)
    const node = ref && 'current' in ref ? ref.current : null
    if (!node) return
    if (!commit) {
      // Restore original on cancel.
      node.innerText = (display == null ? '' : String(display))
      return
    }
    const newValue = node.innerText
    const current = display == null ? '' : String(display)
    if (newValue === current) return
    const result = await ctx.save(field, newValue)
    setSaveStatus(result && result.ok ? 'saved' : 'error')
  }

  const handleBlur = () => { void finish(true) }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const node = ref && 'current' in ref ? ref.current : null
      if (node) node.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      void finish(false)
      const node = ref && 'current' in ref ? ref.current : null
      if (node) node.blur()
    }
  }

  const composedClassName = [
    className,
    'deckio-editable',
    editing && 'deckio-editable--active',
    saveStatus === 'error' && 'deckio-editable--error',
  ].filter(Boolean).join(' ')

  return (
    <Tag
      ref={ref}
      className={composedClassName}
      data-deckio-field={field}
      contentEditable={editing}
      suppressContentEditableWarning
      spellCheck={editing}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      title={editing ? undefined : 'Double-click to edit'}
      {...rest}
    >
      {display}
    </Tag>
  )
})

export default Editable
