/**
 * Inline-edit server helpers + Vite dev middleware.
 *
 * Security posture (Decision 63 + Licha's checklist):
 *   - Dev-only by virtue of being mounted from configureServer.
 *   - Opt-in via deckPlugin({ inlineEditing: true }).
 *   - Refuses requests when Vite is exposed on the network (host != loopback).
 *   - Refuses non-loopback remote clients.
 *   - Same-origin Origin/Referer check when present.
 *   - Requires application/json Content-Type.
 *   - Bounded body / value / line count / total override file size.
 *   - Realpath-based path containment + denylist (node_modules, .git, dist,
 *     lockfiles, package files, engine package paths).
 *   - Per-target async write mutex.
 *   - Atomic write (sibling temp + rename).
 *   - Stable, sanitized error codes (no paths, no stack traces, no usernames).
 *
 * v2 (AST patcher) reuses these helpers — they take server-owned canonical
 * paths, never raw client input.
 */
import { promises as fs, realpathSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const OVERRIDE_REL_PATH = path.posix.join('src', 'data', 'inline-edits.json')
export const ENDPOINT_PATH = '/__deckio/inline-edit'

export const FIELD_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$/
// Item IDs (used inside list-reorder entries) are semantically distinct from
// field names but share the same character class + bounded length. Kept
// separate so we can evolve either independently without surprise coupling.
export const ITEM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$/
export const MAX_VALUE_LENGTH = 4000
export const MAX_VALUE_LINES = 200
export const MAX_BODY_BYTES = 64 * 1024
export const MAX_OVERRIDE_FILE_BYTES = 256 * 1024

// v2 entry-shape limits — see normalizeEntry/isValidStyle/isValidOrder below.
export const MAX_STYLE_KEYS = 10
export const MAX_STYLE_VALUE_LENGTH = 64
export const MAX_ORDER_ITEMS = 200

const LOOPBACK_IPS = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
])

const LOOPBACK_HOST_NAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0:0:0:0:0:0:0:1',
  '[::1]',
])

const DENY_SEGMENTS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.vite',
  '.cache',
  '.next',
  '.turbo',
  '.parcel-cache',
])

const DENY_FILE_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.env',
  '.env.local',
  '.npmrc',
  '.yarnrc',
])

// Stable, user-safe error codes. Messages are intentionally short and
// contain no paths, usernames, or stack traces.
export const ERROR_CODES = Object.freeze({
  DISABLED: 'INLINE_EDIT_DISABLED',
  NETWORK_EXPOSED: 'INLINE_EDIT_DISABLED_REMOTE_HOST',
  REMOTE_CLIENT: 'INLINE_EDIT_REMOTE_CLIENT',
  CROSS_ORIGIN: 'INLINE_EDIT_CROSS_ORIGIN',
  METHOD: 'INLINE_EDIT_METHOD_NOT_ALLOWED',
  CONTENT_TYPE: 'INLINE_EDIT_BAD_CONTENT_TYPE',
  PAYLOAD: 'INLINE_EDIT_BAD_PAYLOAD',
  FIELD: 'INLINE_EDIT_INVALID_FIELD',
  VALUE: 'INLINE_EDIT_INVALID_VALUE',
  TARGET_DENIED: 'INLINE_EDIT_TARGET_DENIED',
  STALE_SOURCE: 'INLINE_EDIT_STALE_SOURCE',
  WRITE_FAILED: 'INLINE_EDIT_WRITE_FAILED',
  TOO_LARGE: 'INLINE_EDIT_OVERRIDE_FILE_TOO_LARGE',
  UNKNOWN_KIND: 'INLINE_EDIT_UNKNOWN_KIND',
  INVALID_PATCH: 'INLINE_EDIT_INVALID_PATCH',
  INVALID_STYLE: 'INLINE_EDIT_INVALID_STYLE',
  INVALID_ORDER: 'INLINE_EDIT_INVALID_ORDER',
})

const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.DISABLED]: 'Inline editing is disabled.',
  [ERROR_CODES.NETWORK_EXPOSED]: 'Inline editing is disabled when the dev server is exposed on the network.',
  [ERROR_CODES.REMOTE_CLIENT]: 'Inline editing only accepts requests from this machine.',
  [ERROR_CODES.CROSS_ORIGIN]: 'Inline editing only accepts requests from the dev server origin.',
  [ERROR_CODES.METHOD]: 'Method not allowed.',
  [ERROR_CODES.CONTENT_TYPE]: 'Content-Type must be application/json.',
  [ERROR_CODES.PAYLOAD]: 'Request body is invalid.',
  [ERROR_CODES.FIELD]: 'Field name is not allowed.',
  [ERROR_CODES.VALUE]: 'Value is too large or contains too many lines.',
  [ERROR_CODES.TARGET_DENIED]: 'Target is not eligible for inline edit.',
  [ERROR_CODES.STALE_SOURCE]: 'Source changed. Refresh and try again.',
  [ERROR_CODES.WRITE_FAILED]: 'Could not save the change.',
  [ERROR_CODES.TOO_LARGE]: 'Override file would exceed the size limit.',
  [ERROR_CODES.UNKNOWN_KIND]: 'Unknown edit kind.',
  [ERROR_CODES.INVALID_PATCH]: 'Patch payload is invalid.',
  [ERROR_CODES.INVALID_STYLE]: 'Style payload contains disallowed keys or values.',
  [ERROR_CODES.INVALID_ORDER]: 'Order payload is invalid.',
})

export function isValidField(field) {
  return typeof field === 'string' && FIELD_PATTERN.test(field)
}

export function isValidValue(value) {
  if (typeof value !== 'string') return false
  if (value.length > MAX_VALUE_LENGTH) return false
  // Bounded line count.
  const lines = value.split('\n').length
  if (lines > MAX_VALUE_LINES) return false
  // Reject unexpected control characters except \t and \n.
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return false
  }
  return true
}

// ----------------------------------------------------------------------
// v2 entry shape — style + list-order facets.
//
// Storage shape stays JSON-friendly and back-compat:
//   - "field": "value"                           (legacy bare text)
//   - "field": { value: "x" }                    (text, equivalent)
//   - "field": { value: "x", style: { ... } }    (text with style override)
//   - "field": { order: [ "a", "b", "c" ] }      (list reorder)
//
// Text and list facets MUST NOT mix on the same field. The normalizer
// drops one or the other rather than silently corrupting consumer logic.
// ----------------------------------------------------------------------

// Style values must be free of CSS structural punctuation — anything that
// could break out of the style="..." attribute or smuggle a declaration in.
// Applies BEFORE any per-key validator.
const STYLE_VALUE_BLOCKLIST = /url\(|expression\(|[@{};<>]|\/\*|\*\//i

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const FUNC_COLOR = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lch|lab)\([^()]+\)$/i
const VAR_TOKEN = /^var\(--[a-zA-Z0-9_-]+(?:\s*,\s*[^()]+)?\)$/
const LEN_UNIT = /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|ch|ex)$/
const NUMERIC_ONLY = /^-?\d+(?:\.\d+)?$/
const CLAMP_LEN = /^clamp\([^()]+\)$/i

const FONT_FAMILY_ALLOWED = new Set([
  'system-ui', 'sans-serif', 'serif', 'monospace', 'ui-sans-serif', 'ui-serif',
  'ui-monospace', 'inter', 'roboto', 'helvetica', 'arial', 'georgia',
  'times new roman', 'menlo', 'consolas', 'jetbrains mono', 'fira code',
])
const FONT_WEIGHT_KEYWORDS = new Set(['normal', 'bold', 'bolder', 'lighter'])
const FONT_STYLE_KEYWORDS = new Set(['normal', 'italic', 'oblique'])
const TEXT_ALIGN_KEYWORDS = new Set(['left', 'center', 'right', 'justify', 'start', 'end'])
const TEXT_TRANSFORM_KEYWORDS = new Set(['none', 'uppercase', 'lowercase', 'capitalize'])

function isValidColor(v) {
  if (HEX_COLOR.test(v)) return true
  if (VAR_TOKEN.test(v)) return true
  if (FUNC_COLOR.test(v)) return true
  return false
}

function isValidLength(v) {
  if (VAR_TOKEN.test(v)) return true
  if (LEN_UNIT.test(v)) return true
  if (CLAMP_LEN.test(v)) return true
  // Unitless multipliers are only valid for line-height; callers gate it.
  return false
}

function isValidFontFamily(v) {
  if (VAR_TOKEN.test(v)) return true
  // Accept a comma-separated stack where every individual family is in the
  // allowlist (case-insensitive, trim quotes/spaces). This lets a deck use
  // a real stack like "Inter, system-ui, sans-serif" without arbitrary
  // injection.
  const parts = v.split(',').map((p) => p.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
  if (parts.length === 0) return false
  for (const p of parts) {
    if (!p) return false
    if (!FONT_FAMILY_ALLOWED.has(p)) return false
  }
  return true
}

function isValidFontWeight(v) {
  if (FONT_WEIGHT_KEYWORDS.has(v.toLowerCase())) return true
  if (NUMERIC_ONLY.test(v)) {
    const n = Number(v)
    return n >= 100 && n <= 900
  }
  return false
}

// Per-key validator table. Each validator receives an already-bounded
// string (length + blocklist already enforced) and returns true if the
// value is acceptable for THIS specific CSS property.
const STYLE_KEY_VALIDATORS = Object.freeze({
  fontFamily: isValidFontFamily,
  fontSize: isValidLength,
  fontWeight: isValidFontWeight,
  fontStyle: (v) => FONT_STYLE_KEYWORDS.has(v.toLowerCase()),
  color: isValidColor,
  lineHeight: (v) => VAR_TOKEN.test(v) || LEN_UNIT.test(v) || NUMERIC_ONLY.test(v),
  letterSpacing: isValidLength,
  textAlign: (v) => TEXT_ALIGN_KEYWORDS.has(v.toLowerCase()),
  textTransform: (v) => TEXT_TRANSFORM_KEYWORDS.has(v.toLowerCase()),
})

export const ALLOWED_STYLE_KEYS = Object.freeze(Object.keys(STYLE_KEY_VALIDATORS))

export function isValidStyle(style) {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return false
  const keys = Object.keys(style)
  if (keys.length === 0) return false
  if (keys.length > MAX_STYLE_KEYS) return false
  for (const key of keys) {
    const validator = STYLE_KEY_VALIDATORS[key]
    if (!validator) return false
    const value = style[key]
    if (typeof value !== 'string') return false
    if (!value.length || value.length > MAX_STYLE_VALUE_LENGTH) return false
    if (STYLE_VALUE_BLOCKLIST.test(value)) return false
    if (!validator(value)) return false
  }
  return true
}

export function isValidOrder(order) {
  if (!Array.isArray(order)) return false
  if (order.length > MAX_ORDER_ITEMS) return false
  const seen = new Set()
  for (const id of order) {
    if (typeof id !== 'string') return false
    if (!ITEM_ID_PATTERN.test(id)) return false
    if (seen.has(id)) return false
    seen.add(id)
  }
  return true
}

/**
 * Normalize a raw store entry into its canonical in-memory shape. Bare
 * strings auto-promote to `{ value }`. Objects are salvaged: only the
 * well-formed `value`, `style`, `order` facets survive. A field cannot
 * mix text and list facets — text wins if both happen to be present
 * (defensive; clients shouldn't send both).
 *
 * Returns `null` if the entry cannot be salvaged at all.
 */
export function normalizeEntry(raw) {
  if (typeof raw === 'string') {
    if (!isValidValue(raw)) return null
    return { value: raw }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const hasValue = Object.prototype.hasOwnProperty.call(raw, 'value')
  const hasStyle = Object.prototype.hasOwnProperty.call(raw, 'style')
  const hasOrder = Object.prototype.hasOwnProperty.call(raw, 'order')

  // Defense: a single entry must not mix text + list facets. If both kinds
  // appear we have no way to know which the caller actually meant, so we
  // drop the entry entirely rather than silently picking one and pretending.
  if (hasOrder && (hasValue || hasStyle)) return null

  // List facet (mutually exclusive with text).
  if (hasOrder) {
    if (!isValidOrder(raw.order)) return null
    return { order: raw.order.slice() }
  }

  if (hasValue || hasStyle) {
    const out = {}
    if (hasValue) {
      if (!isValidValue(raw.value)) return null
      out.value = raw.value
    }
    if (hasStyle) {
      if (!isValidStyle(raw.style)) return null
      out.style = { ...raw.style }
    }
    return out
  }

  return null
}

/**
 * Normalize an entire override store. Drops entries that fail validation
 * instead of throwing — junk shouldn't crash a deck.
 */
export function normalizeStore(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const key of Object.keys(raw)) {
    if (!isValidField(key)) continue
    const entry = normalizeEntry(raw[key])
    if (entry == null) continue
    out[key] = entry
  }
  return out
}

/**
 * Patch shape accepted by the middleware. Each facet is optional but at
 * least one must be present. `value` + `style` go together (text); `order`
 * is mutually exclusive with the text facets.
 */
export function isValidPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false
  const keys = Object.keys(patch)
  if (keys.length === 0) return false
  for (const k of keys) {
    if (k !== 'value' && k !== 'style' && k !== 'order') return false
  }
  const hasOrder = Object.prototype.hasOwnProperty.call(patch, 'order')
  const hasTextFacet = Object.prototype.hasOwnProperty.call(patch, 'value')
    || Object.prototype.hasOwnProperty.call(patch, 'style')
  if (hasOrder && hasTextFacet) return false
  if (Object.prototype.hasOwnProperty.call(patch, 'value') && !isValidValue(patch.value)) return false
  if (Object.prototype.hasOwnProperty.call(patch, 'style') && !isValidStyle(patch.style)) return false
  if (hasOrder && !isValidOrder(patch.order)) return false
  return true
}

/**
 * Merge a validated patch with the existing normalized entry for a field.
 * Returns the new canonical entry (never mutates inputs).
 *
 * Behavior:
 *   - A list-order patch always replaces any prior entry wholesale (a
 *     text→list flip is rare but supported; we don't keep stale value).
 *   - A text patch merges with an existing text entry, preserving
 *     non-overridden facets (e.g. saving `value` keeps prior `style`).
 *   - A text patch on a prior list entry replaces the list entry.
 */
export function mergeEntry(currentEntry, patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'order')) {
    return { order: patch.order.slice() }
  }
  const base = currentEntry && !currentEntry.order
    ? {
      ...(currentEntry.value !== undefined ? { value: currentEntry.value } : {}),
      ...(currentEntry.style ? { style: { ...currentEntry.style } } : {}),
    }
    : {}
  if (Object.prototype.hasOwnProperty.call(patch, 'value')) {
    base.value = patch.value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'style')) {
    base.style = { ...patch.style }
  }
  return base
}

/**
 * Serialize a canonical entry back to the storage shape. Text-only entries
 * (no style) are written as bare strings so simple decks stay diff-friendly
 * and human-editable.
 */
export function serializeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (entry.order) return { order: entry.order.slice() }
  if (entry.style) {
    const out = { style: { ...entry.style } }
    if (entry.value !== undefined) out.value = entry.value
    return out
  }
  if (entry.value !== undefined) return entry.value
  return null
}

/**
 * Apply a persisted reorder array to a source items list, defending
 * against stale IDs (items that have since been removed from source) and
 * new items that aren't in the persisted order yet (they get appended
 * in their source order). Pure helper, shared with the client.
 */
export function applyOrder(orderArray, sourceItems, getId) {
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) return []
  if (typeof getId !== 'function') return sourceItems.slice()
  if (!Array.isArray(orderArray) || orderArray.length === 0) return sourceItems.slice()

  const byId = new Map()
  for (const item of sourceItems) {
    try {
      const id = getId(item)
      if (typeof id === 'string' && id) byId.set(id, item)
    } catch { /* ignore */ }
  }

  const used = new Set()
  const out = []
  for (const id of orderArray) {
    if (!byId.has(id)) continue
    if (used.has(id)) continue
    out.push(byId.get(id))
    used.add(id)
  }
  // Append any source items not present in the order, in source order.
  for (const item of sourceItems) {
    try {
      const id = getId(item)
      if (typeof id !== 'string' || !id) {
        out.push(item)
        continue
      }
      if (!used.has(id)) {
        out.push(item)
        used.add(id)
      }
    } catch {
      out.push(item)
    }
  }
  return out
}

export function hashOverrides(overrides) {
  const text = JSON.stringify(overrides || {})
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/**
 * Determine whether a Vite `server.host` option exposes the dev server
 * outside the loopback interface. `host: undefined | 'localhost' | '127.0.0.1' | '::1'`
 * are loopback. `host: true | '0.0.0.0' | '::' | '<lan ip>' | '<hostname>'` are exposed.
 */
export function isHostExposed(hostOption) {
  if (hostOption === undefined || hostOption === false) return false
  if (hostOption === true) return true
  if (typeof hostOption !== 'string') return true
  const h = hostOption.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (h === '' || h === '0.0.0.0' || h === '::' || h === '*') return true
  return !LOOPBACK_HOST_NAMES.has(h)
}

function realpathOrSelf(p) {
  try { return realpathSync(p) } catch { return p }
}

/**
 * Resolve and validate the override file path under the given project root.
 * Uses realpath to resist symlink escapes. Refuses denylisted segments and
 * package-owned files.
 *
 * - `root` should be the canonical project root (from server.config.root).
 * - `relPath` defaults to the MVP override path; v2 callers may pass a
 *   server-owned path.
 *
 * Throws an Error tagged with `code = ERROR_CODES.TARGET_DENIED` on refusal.
 */
export function safeOverridePath(root, relPath = OVERRIDE_REL_PATH) {
  if (typeof root !== 'string' || !root) {
    const err = new Error('inline-edit: project root is required')
    err.code = ERROR_CODES.TARGET_DENIED
    throw err
  }
  const resolvedRoot = realpathOrSelf(path.resolve(root))
  const target = path.resolve(resolvedRoot, relPath)

  // Realpath the *parent* of the target; the target file may not yet exist.
  const parent = path.dirname(target)
  const realParent = realpathOrSelf(parent)
  const realTarget = path.join(realParent, path.basename(target))

  const rel = path.relative(resolvedRoot, realTarget)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    const err = new Error('inline-edit: target outside project root')
    err.code = ERROR_CODES.TARGET_DENIED
    throw err
  }

  // Denylist segments anywhere in the relative path.
  const segments = rel.split(/[\\/]+/)
  for (const seg of segments) {
    if (DENY_SEGMENTS.has(seg)) {
      const err = new Error('inline-edit: denied path segment')
      err.code = ERROR_CODES.TARGET_DENIED
      throw err
    }
  }

  // Denylist filename for engine/package/lockfile-style writes.
  const base = path.basename(realTarget)
  if (DENY_FILE_BASENAMES.has(base)) {
    const err = new Error('inline-edit: denied filename')
    err.code = ERROR_CODES.TARGET_DENIED
    throw err
  }

  return realTarget
}

export async function readOverrides(file) {
  let raw
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return {}
    throw err
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // Corrupt override file — fall back to empty so dev can recover by editing.
  }
  return {}
}

export async function writeOverridesAtomic(file, data) {
  const dir = path.dirname(file)
  await fs.mkdir(dir, { recursive: true })
  const payload = JSON.stringify(data, null, 2) + '\n'
  if (Buffer.byteLength(payload, 'utf8') > MAX_OVERRIDE_FILE_BYTES) {
    const err = new Error('inline-edit: override file too large')
    err.code = ERROR_CODES.TOO_LARGE
    throw err
  }
  const tmp = path.join(
    dir,
    `.inline-edits.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`,
  )
  await fs.writeFile(tmp, payload, 'utf8')
  try {
    await fs.rename(tmp, file)
  } catch (err) {
    try { await fs.unlink(tmp) } catch { /* ignore */ }
    throw err
  }
}

export function isLoopbackRequest(req) {
  const remote = req && req.socket && req.socket.remoteAddress
  if (!remote) return false
  return LOOPBACK_IPS.has(remote)
}

/**
 * Given an Origin or Referer header value, normalize to a `host` (no port)
 * for comparison. Returns null if not parseable.
 */
function originHostname(value) {
  if (!value || typeof value !== 'string') return null
  try {
    const u = new URL(value)
    return (u.hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  } catch {
    return null
  }
}

/**
 * Same-origin check. Allows: missing Origin (CLI/dev tools), or Origin whose
 * host is loopback. We do not require port equality because Vite dev servers
 * pick ports dynamically.
 */
export function isSameOrigin(req) {
  const origin = req.headers && (req.headers.origin || req.headers.referer)
  if (!origin) return true
  const h = originHostname(origin)
  if (!h) return false
  return LOOPBACK_HOST_NAMES.has(h)
}

function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks = []
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limit) {
        const err = new Error('inline-edit: payload too large')
        err.code = ERROR_CODES.PAYLOAD
        reject(err)
        try { req.destroy() } catch { /* ignore */ }
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        const err = new Error('inline-edit: invalid json')
        err.code = ERROR_CODES.PAYLOAD
        reject(err)
      }
    })
    req.on('error', (e) => {
      const err = new Error('inline-edit: stream error')
      err.code = ERROR_CODES.PAYLOAD
      reject(err)
    })
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function sendError(res, status, code) {
  sendJson(res, status, { ok: false, code, error: code, message: ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.DISABLED] })
}

// Per-target write mutex. Keyed by canonical target path.
const writeLocks = new Map()
async function withWriteLock(key, fn) {
  const previous = writeLocks.get(key) || Promise.resolve()
  let release
  const next = new Promise((r) => { release = r })
  writeLocks.set(key, previous.then(() => next))
  await previous
  try {
    return await fn()
  } finally {
    release()
    if (writeLocks.get(key) === next) writeLocks.delete(key)
  }
}

/**
 * Build a Vite/connect middleware that handles POST /__deckio/inline-edit.
 *
 * Options:
 *   - root          (required) canonical project root
 *   - networkExposed (boolean) if true, every request is refused
 *   - relPath       override-file path relative to root (default fixed MVP path)
 */
export function createInlineEditMiddleware({
  root,
  relPath = OVERRIDE_REL_PATH,
  networkExposed = false,
} = {}) {
  return async function inlineEditMiddleware(req, res, next) {
    if (!req || !req.url) return next()
    // Accept both the canonical path AND any proxy-prefixed variant whose
    // pathname ends in ENDPOINT_PATH (e.g. the launcher's
    // `/preview/<deckId>/__deckio/inline-edit`). Query strings are ignored.
    const url = req.url
    const queryIdx = url.indexOf('?')
    const pathname = queryIdx === -1 ? url : url.slice(0, queryIdx)
    if (pathname !== ENDPOINT_PATH && !pathname.endsWith(ENDPOINT_PATH)) return next()

    if (req.method !== 'POST') {
      sendError(res, 405, ERROR_CODES.METHOD)
      return
    }
    if (networkExposed) {
      sendError(res, 403, ERROR_CODES.NETWORK_EXPOSED)
      return
    }
    if (!isLoopbackRequest(req)) {
      sendError(res, 403, ERROR_CODES.REMOTE_CLIENT)
      return
    }
    if (!isSameOrigin(req)) {
      sendError(res, 403, ERROR_CODES.CROSS_ORIGIN)
      return
    }
    const ctype = (req.headers && req.headers['content-type']) || ''
    if (!String(ctype).toLowerCase().startsWith('application/json')) {
      sendError(res, 415, ERROR_CODES.CONTENT_TYPE)
      return
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch (err) {
      sendError(res, 400, ERROR_CODES.PAYLOAD)
      return
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendError(res, 400, ERROR_CODES.PAYLOAD)
      return
    }

    const { field, value, baseHash, kind, patch } = body
    // v2 readiness: the wire protocol carries an optional `kind` discriminator
    // so the same endpoint can later accept `'source-span'` patches without
    // a breaking rename. MVP only handles `'override'`. Missing kind defaults
    // to `'override'` for back-compat with first-cut clients.
    if (kind != null && kind !== 'override') {
      sendError(res, 400, ERROR_CODES.UNKNOWN_KIND)
      return
    }
    if (!isValidField(field)) {
      sendError(res, 400, ERROR_CODES.FIELD)
      return
    }

    // Resolve the patch. Two accepted wire shapes:
    //  - Bare `{ value }`     — back-compat with MVP text-only clients.
    //  - `{ patch: { value?, style?, order? } }` — v2 facet-patch payload.
    // The patch wrapper is preferred when present and is the only way to
    // send style overrides or list reorders.
    let resolvedPatch = null
    if (patch !== undefined) {
      if (!isValidPatch(patch)) {
        // Drill down so the client gets the most specific code for the bad
        // facet — easier to surface in the UI than a generic INVALID_PATCH.
        if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
          if (Object.prototype.hasOwnProperty.call(patch, 'value') && !isValidValue(patch.value)) {
            sendError(res, 400, ERROR_CODES.VALUE)
            return
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'style') && !isValidStyle(patch.style)) {
            sendError(res, 400, ERROR_CODES.INVALID_STYLE)
            return
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'order') && !isValidOrder(patch.order)) {
            sendError(res, 400, ERROR_CODES.INVALID_ORDER)
            return
          }
        }
        sendError(res, 400, ERROR_CODES.INVALID_PATCH)
        return
      }
      resolvedPatch = patch
    } else {
      // Back-compat: bare `value` (MVP wire shape).
      if (!isValidValue(value)) {
        sendError(res, 400, ERROR_CODES.VALUE)
        return
      }
      resolvedPatch = { value }
    }

    let target
    try {
      target = safeOverridePath(root, relPath)
    } catch (err) {
      sendError(res, 403, ERROR_CODES.TARGET_DENIED)
      return
    }

    try {
      await withWriteLock(target, async () => {
        const rawCurrent = await readOverrides(target)
        // Canonical-on-disk hash: serialize the normalized store back to
        // its storage shape so both client and server compute hashes on
        // the same artifact (bare strings stay bare, styled/ordered fields
        // remain objects).
        const normalizedCurrent = normalizeStore(rawCurrent)
        const canonicalCurrent = serializeStore(normalizedCurrent)
        const currentHash = hashOverrides(canonicalCurrent)
        if (typeof baseHash === 'string' && baseHash && baseHash !== currentHash) {
          sendJson(res, 409, {
            ok: false,
            code: ERROR_CODES.STALE_SOURCE,
            error: ERROR_CODES.STALE_SOURCE,
            message: ERROR_MESSAGES[ERROR_CODES.STALE_SOURCE],
            hash: currentHash,
          })
          return
        }
        const mergedEntry = mergeEntry(normalizedCurrent[field], resolvedPatch)
        normalizedCurrent[field] = mergedEntry
        const canonicalNext = serializeStore(normalizedCurrent)
        await writeOverridesAtomic(target, canonicalNext)
        const nextHash = hashOverrides(canonicalNext)
        sendJson(res, 200, {
          ok: true,
          field,
          hash: nextHash,
          entry: canonicalNext[field],
        })
      })
    } catch (err) {
      const code = (err && err.code && typeof err.code === 'string' && err.code.startsWith('INLINE_EDIT_'))
        ? err.code
        : ERROR_CODES.WRITE_FAILED
      sendError(res, code === ERROR_CODES.TOO_LARGE ? 413 : 500, code)
    }
  }
}

/**
 * Convert a normalized in-memory store back to the storage shape. Mirror of
 * `normalizeStore` for the write path; uses `serializeEntry` so text-only
 * entries stay bare strings (smallest diff, human-editable).
 */
export function serializeStore(normalized) {
  const out = {}
  if (!normalized || typeof normalized !== 'object') return out
  for (const key of Object.keys(normalized)) {
    const ser = serializeEntry(normalized[key])
    if (ser != null) out[key] = ser
  }
  return out
}
