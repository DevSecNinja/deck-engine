import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import {
  createInlineEditMiddleware,
  hashOverrides,
  isLoopbackRequest,
  isValidField,
  isValidValue,
  readOverrides,
  safeOverridePath,
  writeOverridesAtomic,
  OVERRIDE_REL_PATH,
} from '../server/inline-edit-server.mjs'

let tempRoot
beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'deckio-inline-edit-'))
})
afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true })
})

describe('field + value validation', () => {
  it('accepts dotted lowercase identifiers', () => {
    expect(isValidField('cover.title')).toBe(true)
    expect(isValidField('hero.subtitle_2')).toBe(true)
    expect(isValidField('a-b.c-d')).toBe(true)
  })

  it('rejects path traversal, empty, and oversized fields', () => {
    expect(isValidField('')).toBe(false)
    expect(isValidField('../etc/passwd')).toBe(false)
    expect(isValidField('foo/bar')).toBe(false)
    expect(isValidField('foo bar')).toBe(false)
    expect(isValidField('.hidden')).toBe(false)
    expect(isValidField('a'.repeat(200))).toBe(false)
    expect(isValidField(123)).toBe(false)
    expect(isValidField(null)).toBe(false)
  })

  it('accepts strings up to 4000 chars', () => {
    expect(isValidValue('hello')).toBe(true)
    expect(isValidValue('')).toBe(true)
    expect(isValidValue('a'.repeat(4000))).toBe(true)
    expect(isValidValue('a'.repeat(4001))).toBe(false)
    expect(isValidValue(42)).toBe(false)
  })
})

describe('safeOverridePath', () => {
  it('resolves under project root', () => {
    const target = safeOverridePath(tempRoot)
    expect(target.endsWith(join('src', 'data', 'inline-edits.json'))).toBe(true)
    expect(target.startsWith(tempRoot)).toBe(true)
  })

  it('refuses paths that escape the project root', () => {
    expect(() => safeOverridePath(tempRoot, '../escape.json')).toThrow(/escapes/)
    expect(() => safeOverridePath(tempRoot, '/etc/passwd')).toThrow(/escapes/)
  })

  it('throws without a root', () => {
    expect(() => safeOverridePath('')).toThrow(/root/)
  })
})

describe('writeOverridesAtomic + readOverrides', () => {
  it('creates parent directory and writes JSON', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'cover.title': 'Hello' })
    expect(existsSync(target)).toBe(true)
    const parsed = JSON.parse(readFileSync(target, 'utf8'))
    expect(parsed['cover.title']).toBe('Hello')
  })

  it('returns empty object for missing file', async () => {
    const target = safeOverridePath(tempRoot)
    expect(await readOverrides(target)).toEqual({})
  })

  it('returns empty object when file is malformed', async () => {
    const target = safeOverridePath(tempRoot)
    mkdirSync(join(tempRoot, 'src', 'data'), { recursive: true })
    writeFileSync(target, 'not-json')
    expect(await readOverrides(target)).toEqual({})
  })

  it('does not leave temp files behind on success', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { a: '1' })
    await writeOverridesAtomic(target, { a: '2' })
    const dir = join(tempRoot, 'src', 'data')
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(dir)
    expect(files.filter((f) => f.includes('.tmp')).length).toBe(0)
    expect(files).toContain('inline-edits.json')
  })
})

describe('isLoopbackRequest', () => {
  it('accepts loopback addresses', () => {
    expect(isLoopbackRequest({ socket: { remoteAddress: '127.0.0.1' } })).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::1' } })).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::ffff:127.0.0.1' } })).toBe(true)
  })

  it('refuses non-loopback', () => {
    expect(isLoopbackRequest({ socket: { remoteAddress: '10.0.0.5' } })).toBe(false)
    expect(isLoopbackRequest({ socket: {} })).toBe(false)
    expect(isLoopbackRequest({})).toBe(false)
  })
})

// --- Middleware integration: drive through fake req/res -----------------

class FakeReq extends EventEmitter {
  constructor({ method = 'POST', url = '/__deckio/inline-edit', remoteAddress = '127.0.0.1' } = {}) {
    super()
    this.method = method
    this.url = url
    this.socket = { remoteAddress }
  }
  destroy() { /* noop for tests */ }
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

async function runMiddleware(mw, req, res) {
  let nextCalled = false
  await mw(req, res, () => { nextCalled = true })
  // Wait for any pending async work
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
  return { nextCalled }
}

describe('createInlineEditMiddleware', () => {
  it('writes a valid override and returns ok with hash', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const done = mw(req, res, () => {})
    send(req, JSON.stringify({ field: 'cover.title', value: 'New Title' }))
    await done
    await new Promise((r) => setTimeout(r, 30))
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.ok).toBe(true)
    expect(reply.field).toBe('cover.title')
    expect(typeof reply.hash).toBe('string')
    expect(reply.hash.length).toBeGreaterThan(0)
    const written = JSON.parse(readFileSync(safeOverridePath(tempRoot), 'utf8'))
    expect(written['cover.title']).toBe('New Title')
    expect(reply.hash).toBe(hashOverrides(written))
  })

  it('rejects non-loopback requests with 403', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ remoteAddress: '8.8.8.8' })
    const res = new FakeRes()
    const done = mw(req, res, () => {})
    send(req, JSON.stringify({ field: 'cover.title', value: 'x' }))
    await done
    expect(res.statusCode).toBe(403)
    expect(existsSync(join(tempRoot, OVERRIDE_REL_PATH))).toBe(false)
  })

  it('rejects non-POST with 405', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ method: 'GET' })
    const res = new FakeRes()
    await mw(req, res, () => {})
    expect(res.statusCode).toBe(405)
  })

  it('passes through unrelated URLs', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ url: '/something-else' })
    const res = new FakeRes()
    let nextCalled = false
    await mw(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(res.ended).toBe(false)
  })

  it('rejects invalid field with 400', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const done = mw(req, res, () => {})
    send(req, JSON.stringify({ field: '../escape', value: 'oops' }))
    await done
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('invalid-field')
  })

  it('rejects oversized value with 400', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const done = mw(req, res, () => {})
    send(req, JSON.stringify({ field: 'cover.title', value: 'a'.repeat(5000) }))
    await done
    expect(res.statusCode).toBe(400)
  })

  it('merges with existing overrides instead of clobbering', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'kept' })

    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const done = mw(req, res, () => {})
    send(req, JSON.stringify({ field: 'cover.title', value: 'added' }))
    await done
    await new Promise((r) => setTimeout(r, 30))

    const written = JSON.parse(readFileSync(target, 'utf8'))
    expect(written['a.b']).toBe('kept')
    expect(written['cover.title']).toBe('added')
  })

  it('returns 409 source-changed when baseHash does not match', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'truth' })

    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const done = mw(req, res, () => {})
    send(req, JSON.stringify({ field: 'cover.title', value: 'oops', baseHash: 'stale-hash' }))
    await done
    await new Promise((r) => setTimeout(r, 30))

    expect(res.statusCode).toBe(409)
    const reply = JSON.parse(res.body)
    expect(reply.error).toBe('source-changed')
    expect(reply.hash).toBe(hashOverrides({ 'a.b': 'truth' }))
    // File was not touched.
    const after = JSON.parse(readFileSync(target, 'utf8'))
    expect(after).toEqual({ 'a.b': 'truth' })
  })

  it('accepts a baseHash that matches and returns the new hash', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'truth' })
    const baseHash = hashOverrides({ 'a.b': 'truth' })

    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const done = mw(req, res, () => {})
    send(req, JSON.stringify({ field: 'cover.title', value: 'added', baseHash }))
    await done
    await new Promise((r) => setTimeout(r, 30))

    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.ok).toBe(true)
    expect(reply.hash).not.toBe(baseHash)
  })
})

describe('hashOverrides', () => {
  it('is stable across calls for equivalent input', () => {
    expect(hashOverrides({ a: '1' })).toBe(hashOverrides({ a: '1' }))
  })
  it('changes when content changes', () => {
    expect(hashOverrides({ a: '1' })).not.toBe(hashOverrides({ a: '2' }))
  })
})
