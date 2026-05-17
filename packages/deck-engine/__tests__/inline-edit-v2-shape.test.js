// @vitest-environment node
//
// v2 entry-shape tests for the inline-edit server. Covers:
//   - isValidStyle (per-key validators, blocklist, size caps)
//   - isValidOrder (bounded, no dupes, ITEM_ID_PATTERN)
//   - isValidPatch (mutually exclusive facets, optional keys)
//   - normalizeEntry / normalizeStore (legacy bare string, salvage, fail-closed)
//   - mergeEntry (text+style merge, list replaces, list↔text flips)
//   - serializeEntry (text-only → bare string, styled → object form)
//   - applyOrder (stale IDs dropped, new source items appended)
//
// And the patch-aware middleware:
//   - back-compat with bare `{value}` payloads (existing test passes)
//   - `{patch:{value}}` round-trip writes bare string
//   - `{patch:{value, style}}` round-trip writes object form
//   - `{patch:{style}}` on existing text entry preserves value
//   - `{patch:{order}}` round-trip writes list entry
//   - patch with both text + list facet rejected
//   - patch with unknown key rejected
//   - invalid style values rejected with specific code
//   - invalid order ids rejected with specific code
//   - canonical hash is stable across legacy-bare-string and v2 round-trips

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import {
  ALLOWED_STYLE_KEYS,
  ERROR_CODES,
  ITEM_ID_PATTERN,
  MAX_ORDER_ITEMS,
  MAX_STYLE_KEYS,
  MAX_STYLE_VALUE_LENGTH,
  applyOrder,
  createInlineEditMiddleware,
  hashOverrides,
  isValidOrder,
  isValidPatch,
  isValidStyle,
  mergeEntry,
  normalizeEntry,
  normalizeStore,
  safeOverridePath,
  serializeEntry,
  serializeStore,
  writeOverridesAtomic,
} from '../server/inline-edit-server.mjs'

let tempRoot
beforeEach(() => { tempRoot = mkdtempSync(join(tmpdir(), 'deckio-inline-edit-v2-')) })
afterEach(() => { rmSync(tempRoot, { recursive: true, force: true }) })

// ----------------------------------------------------------------------
// isValidStyle
// ----------------------------------------------------------------------

describe('isValidStyle', () => {
  it('accepts a typical theme-token + length style', () => {
    expect(isValidStyle({
      color: 'var(--accent)',
      fontSize: '1.25rem',
      fontWeight: '600',
      textAlign: 'center',
    })).toBe(true)
  })

  it('accepts hex, rgb, hsl, oklch colors', () => {
    expect(isValidStyle({ color: '#abc' })).toBe(true)
    expect(isValidStyle({ color: '#aabbcc' })).toBe(true)
    expect(isValidStyle({ color: '#aabbcc88' })).toBe(true)
    expect(isValidStyle({ color: 'rgb(10, 20, 30)' })).toBe(true)
    expect(isValidStyle({ color: 'rgba(10, 20, 30, 0.5)' })).toBe(true)
    expect(isValidStyle({ color: 'hsl(120, 50%, 50%)' })).toBe(true)
    expect(isValidStyle({ color: 'oklch(0.5 0.1 200)' })).toBe(true)
  })

  it('rejects unknown style keys', () => {
    expect(isValidStyle({ width: '100px' })).toBe(false)
    expect(isValidStyle({ background: '#fff' })).toBe(false)
    expect(isValidStyle({ position: 'absolute' })).toBe(false)
    expect(isValidStyle({ '--custom': '1' })).toBe(false)
  })

  it('rejects empty object, arrays, null, non-string values', () => {
    expect(isValidStyle({})).toBe(false)
    expect(isValidStyle(null)).toBe(false)
    expect(isValidStyle([])).toBe(false)
    expect(isValidStyle({ color: 123 })).toBe(false)
    expect(isValidStyle({ color: null })).toBe(false)
  })

  it('enforces per-value length cap', () => {
    expect(isValidStyle({ color: '#' + 'a'.repeat(MAX_STYLE_VALUE_LENGTH) })).toBe(false)
  })

  it('enforces max-keys cap', () => {
    const tooMany = {}
    for (let i = 0; i < MAX_STYLE_KEYS + 1; i++) tooMany['color' + i] = '#000'
    expect(isValidStyle(tooMany)).toBe(false)
  })

  it('blocks CSS structural punctuation that would break out of style attr', () => {
    expect(isValidStyle({ color: 'red; background:url(x)' })).toBe(false)
    expect(isValidStyle({ color: 'url(evil.png)' })).toBe(false)
    expect(isValidStyle({ color: 'expression(alert(1))' })).toBe(false)
    expect(isValidStyle({ color: '#fff /* comment */' })).toBe(false)
    expect(isValidStyle({ color: '#fff }' })).toBe(false)
    expect(isValidStyle({ color: '#fff @import' })).toBe(false)
    expect(isValidStyle({ color: '<script>' })).toBe(false)
  })

  it('accepts a font-family stack of allowed families', () => {
    expect(isValidStyle({ fontFamily: 'Inter, system-ui, sans-serif' })).toBe(true)
    expect(isValidStyle({ fontFamily: '"Inter", system-ui' })).toBe(true)
    expect(isValidStyle({ fontFamily: 'var(--font-sans)' })).toBe(true)
  })

  it('rejects arbitrary unknown font families', () => {
    expect(isValidStyle({ fontFamily: 'Comic Sans MS' })).toBe(false)
    expect(isValidStyle({ fontFamily: 'evilfont' })).toBe(false)
  })

  it('accepts CSS lengths, clamp(), and var() for fontSize', () => {
    expect(isValidStyle({ fontSize: '16px' })).toBe(true)
    expect(isValidStyle({ fontSize: '1.25rem' })).toBe(true)
    expect(isValidStyle({ fontSize: '1em' })).toBe(true)
    expect(isValidStyle({ fontSize: 'clamp(1rem, 2vw, 2rem)' })).toBe(true)
    expect(isValidStyle({ fontSize: 'var(--text-lg)' })).toBe(true)
  })

  it('rejects unit-less and bogus fontSize', () => {
    expect(isValidStyle({ fontSize: '16' })).toBe(false)
    expect(isValidStyle({ fontSize: 'huge' })).toBe(false)
  })

  it('validates fontWeight as 100–900 or keyword', () => {
    expect(isValidStyle({ fontWeight: '600' })).toBe(true)
    expect(isValidStyle({ fontWeight: '100' })).toBe(true)
    expect(isValidStyle({ fontWeight: '900' })).toBe(true)
    expect(isValidStyle({ fontWeight: 'bold' })).toBe(true)
    expect(isValidStyle({ fontWeight: '50' })).toBe(false)
    expect(isValidStyle({ fontWeight: '950' })).toBe(false)
    expect(isValidStyle({ fontWeight: 'extra-bold' })).toBe(false)
  })

  it('validates enums for fontStyle / textAlign / textTransform', () => {
    expect(isValidStyle({ fontStyle: 'italic' })).toBe(true)
    expect(isValidStyle({ textAlign: 'center' })).toBe(true)
    expect(isValidStyle({ textTransform: 'uppercase' })).toBe(true)
    expect(isValidStyle({ fontStyle: 'wonky' })).toBe(false)
    expect(isValidStyle({ textAlign: 'middle' })).toBe(false)
    expect(isValidStyle({ textTransform: 'titlecase' })).toBe(false)
  })

  it('ALLOWED_STYLE_KEYS exposes the full allowlist for clients', () => {
    expect(ALLOWED_STYLE_KEYS).toContain('color')
    expect(ALLOWED_STYLE_KEYS).toContain('fontSize')
    expect(ALLOWED_STYLE_KEYS).not.toContain('background')
  })
})

// ----------------------------------------------------------------------
// isValidOrder + ITEM_ID_PATTERN
// ----------------------------------------------------------------------

describe('isValidOrder', () => {
  it('accepts arrays of distinct well-formed IDs', () => {
    expect(isValidOrder([])).toBe(true)
    expect(isValidOrder(['a', 'b', 'c'])).toBe(true)
    expect(isValidOrder(['agenda.intro', 'agenda.break', 'agenda.q-and-a'])).toBe(true)
  })

  it('rejects non-arrays', () => {
    expect(isValidOrder(null)).toBe(false)
    expect(isValidOrder('a,b,c')).toBe(false)
    expect(isValidOrder({ 0: 'a' })).toBe(false)
  })

  it('rejects duplicates', () => {
    expect(isValidOrder(['a', 'b', 'a'])).toBe(false)
  })

  it('rejects malformed IDs', () => {
    expect(isValidOrder(['a', ''])).toBe(false)
    expect(isValidOrder(['../escape'])).toBe(false)
    expect(isValidOrder(['has space'])).toBe(false)
    expect(isValidOrder([42])).toBe(false)
    expect(isValidOrder([null])).toBe(false)
  })

  it('enforces MAX_ORDER_ITEMS cap', () => {
    const tooMany = Array.from({ length: MAX_ORDER_ITEMS + 1 }, (_, i) => 'id' + i)
    expect(isValidOrder(tooMany)).toBe(false)
  })

  it('ITEM_ID_PATTERN matches valid IDs and rejects path-traversal / spaces', () => {
    expect(ITEM_ID_PATTERN.test('a.b-c_d')).toBe(true)
    expect(ITEM_ID_PATTERN.test('../bad')).toBe(false)
    expect(ITEM_ID_PATTERN.test('with space')).toBe(false)
  })
})

// ----------------------------------------------------------------------
// isValidPatch
// ----------------------------------------------------------------------

describe('isValidPatch', () => {
  it('accepts a value-only patch (text)', () => {
    expect(isValidPatch({ value: 'hi' })).toBe(true)
  })
  it('accepts a style-only patch', () => {
    expect(isValidPatch({ style: { color: '#fff' } })).toBe(true)
  })
  it('accepts a value+style patch', () => {
    expect(isValidPatch({ value: 'hi', style: { color: '#fff' } })).toBe(true)
  })
  it('accepts an order-only patch', () => {
    expect(isValidPatch({ order: ['a', 'b'] })).toBe(true)
  })
  it('rejects empty patch', () => {
    expect(isValidPatch({})).toBe(false)
  })
  it('rejects mixing list + text facets on same patch', () => {
    expect(isValidPatch({ value: 'x', order: ['a'] })).toBe(false)
    expect(isValidPatch({ style: { color: '#fff' }, order: ['a'] })).toBe(false)
  })
  it('rejects unknown patch keys', () => {
    expect(isValidPatch({ value: 'x', extra: 1 })).toBe(false)
    expect(isValidPatch({ position: { x: 0, y: 0 } })).toBe(false)
  })
  it('rejects invalid facets', () => {
    expect(isValidPatch({ value: 42 })).toBe(false)
    expect(isValidPatch({ style: { width: '10px' } })).toBe(false)
    expect(isValidPatch({ order: ['a', 'a'] })).toBe(false)
  })
  it('rejects non-objects', () => {
    expect(isValidPatch(null)).toBe(false)
    expect(isValidPatch([])).toBe(false)
    expect(isValidPatch('value')).toBe(false)
  })
})

// ----------------------------------------------------------------------
// normalizeEntry / normalizeStore
// ----------------------------------------------------------------------

describe('normalizeEntry', () => {
  it('auto-promotes bare strings to { value }', () => {
    expect(normalizeEntry('hello')).toEqual({ value: 'hello' })
  })
  it('returns null for invalid bare strings (control chars)', () => {
    expect(normalizeEntry('\u0000')).toBe(null)
  })
  it('salvages a valid {value} object', () => {
    expect(normalizeEntry({ value: 'x' })).toEqual({ value: 'x' })
  })
  it('salvages {value, style}', () => {
    expect(normalizeEntry({ value: 'x', style: { color: '#fff' } }))
      .toEqual({ value: 'x', style: { color: '#fff' } })
  })
  it('salvages style-only', () => {
    expect(normalizeEntry({ style: { color: '#fff' } }))
      .toEqual({ style: { color: '#fff' } })
  })
  it('salvages an order entry', () => {
    expect(normalizeEntry({ order: ['a', 'b'] })).toEqual({ order: ['a', 'b'] })
  })
  it('drops nonsense entries entirely', () => {
    expect(normalizeEntry(null)).toBe(null)
    expect(normalizeEntry(42)).toBe(null)
    expect(normalizeEntry([])).toBe(null)
    expect(normalizeEntry({})).toBe(null)
    expect(normalizeEntry({ foo: 'bar' })).toBe(null)
  })
  it('drops entries where style is invalid', () => {
    expect(normalizeEntry({ value: 'x', style: { width: '10px' } })).toBe(null)
  })
  it('drops entries where order is invalid', () => {
    expect(normalizeEntry({ order: ['..bad'] })).toBe(null)
  })
  it('drops entries mixing text + list facets (defense)', () => {
    expect(normalizeEntry({ value: 'x', order: ['a'] })).toBe(null)
    expect(normalizeEntry({ style: { color: '#fff' }, order: ['a'] })).toBe(null)
  })
})

describe('normalizeStore', () => {
  it('filters out invalid field keys', () => {
    expect(normalizeStore({ 'cover.title': 'x', '../bad': 'y', '_private': 'z' }))
      .toEqual({ 'cover.title': { value: 'x' } })
  })
  it('drops nonsense entries silently', () => {
    expect(normalizeStore({ 'a.b': 'x', 'c.d': { foo: 'bar' }, 'e.f': null }))
      .toEqual({ 'a.b': { value: 'x' } })
  })
  it('returns empty for non-object input', () => {
    expect(normalizeStore(null)).toEqual({})
    expect(normalizeStore([])).toEqual({})
    expect(normalizeStore('str')).toEqual({})
  })
})

// ----------------------------------------------------------------------
// mergeEntry
// ----------------------------------------------------------------------

describe('mergeEntry', () => {
  it('text value patch on undefined entry', () => {
    expect(mergeEntry(undefined, { value: 'x' })).toEqual({ value: 'x' })
  })
  it('text style patch on existing value preserves value', () => {
    expect(mergeEntry({ value: 'kept' }, { style: { color: '#fff' } }))
      .toEqual({ value: 'kept', style: { color: '#fff' } })
  })
  it('text value patch on existing styled entry preserves style', () => {
    expect(mergeEntry({ value: 'old', style: { color: '#fff' } }, { value: 'new' }))
      .toEqual({ value: 'new', style: { color: '#fff' } })
  })
  it('order patch replaces any prior entry entirely', () => {
    expect(mergeEntry({ value: 'old' }, { order: ['a', 'b'] }))
      .toEqual({ order: ['a', 'b'] })
  })
  it('text patch on prior list entry replaces it (no leftover order)', () => {
    expect(mergeEntry({ order: ['x'] }, { value: 'now-text' }))
      .toEqual({ value: 'now-text' })
  })
  it('does not mutate inputs', () => {
    const current = { value: 'a', style: { color: '#fff' } }
    const patch = { style: { color: '#000' } }
    mergeEntry(current, patch)
    expect(current).toEqual({ value: 'a', style: { color: '#fff' } })
    expect(patch).toEqual({ style: { color: '#000' } })
  })
})

// ----------------------------------------------------------------------
// serializeEntry / serializeStore
// ----------------------------------------------------------------------

describe('serializeEntry', () => {
  it('writes text-only entry as bare string', () => {
    expect(serializeEntry({ value: 'hi' })).toBe('hi')
  })
  it('writes styled entry as object', () => {
    expect(serializeEntry({ value: 'hi', style: { color: '#fff' } }))
      .toEqual({ value: 'hi', style: { color: '#fff' } })
  })
  it('writes style-only entry as object', () => {
    expect(serializeEntry({ style: { color: '#fff' } }))
      .toEqual({ style: { color: '#fff' } })
  })
  it('writes order entry as object', () => {
    expect(serializeEntry({ order: ['a', 'b'] })).toEqual({ order: ['a', 'b'] })
  })
  it('drops invalid entries to null', () => {
    expect(serializeEntry(null)).toBe(null)
    expect(serializeEntry({})).toBe(null)
  })
})

describe('serializeStore', () => {
  it('round-trips through normalize → serialize cleanly', () => {
    const raw = {
      'cover.title': 'Hi',
      'cover.styled': { value: 'Hello', style: { color: '#fff' } },
      'list.items': { order: ['a', 'b'] },
      'junk': null,
    }
    const out = serializeStore(normalizeStore(raw))
    expect(out['cover.title']).toBe('Hi')
    expect(out['cover.styled']).toEqual({ value: 'Hello', style: { color: '#fff' } })
    expect(out['list.items']).toEqual({ order: ['a', 'b'] })
    expect(out.junk).toBeUndefined()
  })
})

// ----------------------------------------------------------------------
// applyOrder
// ----------------------------------------------------------------------

describe('applyOrder', () => {
  const items = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ]
  const getId = (it) => it.id

  it('returns source order when no order array provided', () => {
    expect(applyOrder(null, items, getId)).toEqual(items)
    expect(applyOrder([], items, getId)).toEqual(items)
  })

  it('reorders by the provided ID list', () => {
    expect(applyOrder(['c', 'a', 'b'], items, getId).map(getId)).toEqual(['c', 'a', 'b'])
  })

  it('drops stale IDs that no longer exist in source', () => {
    expect(applyOrder(['a', 'gone', 'b'], items, getId).map(getId))
      .toEqual(['a', 'b', 'c']) // 'gone' dropped, 'c' appended (new from source)
  })

  it('appends new source items in source order', () => {
    expect(applyOrder(['b'], items, getId).map(getId))
      .toEqual(['b', 'a', 'c'])
  })

  it('handles duplicate IDs in order array idempotently', () => {
    expect(applyOrder(['a', 'a', 'b'], items, getId).map(getId))
      .toEqual(['a', 'b', 'c'])
  })

  it('handles items with no ID (appended in source order)', () => {
    const mixed = [
      { id: 'a' },
      { label: 'noid' },
      { id: 'b' },
    ]
    const result = applyOrder(['b'], mixed, (it) => it.id)
    // 'b' first, then source remainder in source order
    expect(result.map((it) => it.id || it.label)).toEqual(['b', 'a', 'noid'])
  })

  it('returns source order if getId is not a function', () => {
    expect(applyOrder(['a', 'b'], items, null)).toEqual(items)
  })

  it('returns [] for empty source', () => {
    expect(applyOrder(['a'], [], getId)).toEqual([])
  })
})

// ----------------------------------------------------------------------
// middleware — patch wire shape
// ----------------------------------------------------------------------

class FakeReq extends EventEmitter {
  constructor({
    method = 'POST',
    url = '/__deckio/inline-edit',
    remoteAddress = '127.0.0.1',
    contentType = 'application/json',
    origin,
  } = {}) {
    super()
    this.method = method
    this.url = url
    this.socket = { remoteAddress }
    this.headers = {}
    if (contentType) this.headers['content-type'] = contentType
    if (origin) this.headers['origin'] = origin
  }
  destroy() {}
}

class FakeRes {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.body = ''
    this.ended = false
  }
  setHeader(name, val) { this.headers[name.toLowerCase()] = val }
  end(body) { this.body = body || ''; this.ended = true }
}

function send(req, body) {
  setImmediate(() => {
    if (body !== null) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
}

async function drive(mw, req, res, body) {
  const p = mw(req, res, () => {})
  if (body !== undefined) send(req, typeof body === 'string' ? body : JSON.stringify(body))
  await p
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

describe('middleware: facet-patch payloads', () => {
  it('value-only patch round-trips as a bare string on disk', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', patch: { value: 'Welcome' } })
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.ok).toBe(true)
    expect(reply.entry).toBe('Welcome')
    const written = JSON.parse(readFileSync(safeOverridePath(tempRoot), 'utf8'))
    expect(written['cover.title']).toBe('Welcome')
  })

  it('value+style patch round-trips as object form', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'cover.title',
      patch: { value: 'Welcome', style: { color: 'var(--accent)', fontSize: '2rem' } },
    })
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.entry).toEqual({ value: 'Welcome', style: { color: 'var(--accent)', fontSize: '2rem' } })
    const written = JSON.parse(readFileSync(safeOverridePath(tempRoot), 'utf8'))
    expect(written['cover.title']).toEqual({ value: 'Welcome', style: { color: 'var(--accent)', fontSize: '2rem' } })
  })

  it('style-only patch on existing text entry preserves value', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'cover.title': 'Hi' })
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'cover.title',
      patch: { style: { color: '#fff' } },
    })
    expect(res.statusCode).toBe(200)
    const written = JSON.parse(readFileSync(target, 'utf8'))
    expect(written['cover.title']).toEqual({ value: 'Hi', style: { color: '#fff' } })
  })

  it('value-only patch on existing styled entry preserves style', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, {
      'cover.title': { value: 'Old', style: { color: '#fff' } },
    })
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'cover.title',
      patch: { value: 'New' },
    })
    expect(res.statusCode).toBe(200)
    const written = JSON.parse(readFileSync(target, 'utf8'))
    expect(written['cover.title']).toEqual({ value: 'New', style: { color: '#fff' } })
  })

  it('order patch round-trips as list entry', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'features.items',
      patch: { order: ['speed', 'pricing', 'quality'] },
    })
    expect(res.statusCode).toBe(200)
    const written = JSON.parse(readFileSync(safeOverridePath(tempRoot), 'utf8'))
    expect(written['features.items']).toEqual({ order: ['speed', 'pricing', 'quality'] })
  })

  it('rejects patch with both value and order with 400 INVALID_PATCH', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'x.y',
      patch: { value: 'x', order: ['a'] },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.INVALID_PATCH)
  })

  it('rejects patch with unknown facet with 400 INVALID_PATCH', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'x.y',
      patch: { value: 'x', position: { x: 0, y: 0 } },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.INVALID_PATCH)
  })

  it('rejects patch with invalid style key with 400 INVALID_STYLE', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'x.y',
      patch: { style: { width: '100px' } },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.INVALID_STYLE)
  })

  it('rejects patch with structural punctuation in style value', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'x.y',
      patch: { style: { color: 'red; background:url(x)' } },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.INVALID_STYLE)
  })

  it('rejects patch with invalid order id with 400 INVALID_ORDER', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'x.y',
      patch: { order: ['ok', '../bad'] },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.INVALID_ORDER)
  })

  it('rejects empty patch object', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { field: 'x.y', patch: {} })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.INVALID_PATCH)
  })

  it('legacy bare {value} payload is still accepted (back-compat)', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'Legacy MVP client' })
    expect(res.statusCode).toBe(200)
    const written = JSON.parse(readFileSync(safeOverridePath(tempRoot), 'utf8'))
    expect(written['cover.title']).toBe('Legacy MVP client')
  })
})

// ----------------------------------------------------------------------
// canonical-hash stability
// ----------------------------------------------------------------------

describe('canonical-hash stability', () => {
  it('hash on writeOverridesAtomic({field:string}) matches hash on serialized store', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'truth' })
    const canonical = serializeStore(normalizeStore({ 'a.b': 'truth' }))
    expect(canonical).toEqual({ 'a.b': 'truth' })
    expect(hashOverrides(canonical)).toBe(hashOverrides({ 'a.b': 'truth' }))
  })

  it('STALE_SOURCE returns the canonical hash so the next save can succeed', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'truth' })

    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, {
      field: 'cover.title',
      patch: { value: 'x' },
      baseHash: 'stale',
    })
    expect(res.statusCode).toBe(409)
    const reply = JSON.parse(res.body)
    expect(reply.hash).toBe(hashOverrides({ 'a.b': 'truth' }))

    // Resend with the returned hash — should succeed.
    const req2 = new FakeReq(); const res2 = new FakeRes()
    await drive(mw, req2, res2, {
      field: 'cover.title',
      patch: { value: 'x' },
      baseHash: reply.hash,
    })
    expect(res2.statusCode).toBe(200)
  })
})
