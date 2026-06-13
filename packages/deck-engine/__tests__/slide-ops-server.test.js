// @vitest-environment node
//
// Integration tests for the slide-ops dev middleware. Drives the connect-style
// middleware with fake req/res against a temp deck dir and asserts on the
// deck.config.js written to disk, the JSON reply, and slide-file deletion.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'

import { createSlideOpsMiddleware } from '../server/slide-ops-server.mjs'

let tempRoot

const CONFIG = `import CoverSlide from './src/slides/CoverSlide.jsx'
import AgendaSlide from './src/slides/AgendaSlide.jsx'
import { GenericThankYouSlide as ThankYouSlide } from '@deckio/deck-engine'

export default {
  id: 'demo',
  title: 'Demo',
  slides: [
    CoverSlide,
    AgendaSlide,
    ThankYouSlide,
  ],
}
`

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'slide-ops-mw-'))
  writeFileSync(join(tempRoot, 'deck.config.js'), CONFIG, 'utf8')
  mkdirSync(join(tempRoot, 'src', 'slides'), { recursive: true })
  for (const name of ['CoverSlide', 'AgendaSlide']) {
    writeFileSync(join(tempRoot, 'src', 'slides', `${name}.jsx`), `export default function ${name}(){return null}`, 'utf8')
    writeFileSync(join(tempRoot, 'src', 'slides', `${name}.module.css`), `.x{}`, 'utf8')
  }
})

afterEach(() => {
  try { rmSync(tempRoot, { recursive: true, force: true }) } catch { /* ignore */ }
})

class FakeReq extends EventEmitter {
  constructor({
    method = 'POST',
    url = '/__deckio/slide-op',
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
  let nextCalled = false
  const p = mw(req, res, () => { nextCalled = true })
  if (body !== undefined) send(req, typeof body === 'string' ? body : JSON.stringify(body))
  await p
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
  return nextCalled
}

const config = () => readFileSync(join(tempRoot, 'deck.config.js'), 'utf8')

describe('slide-ops middleware: dispatch + persistence', () => {
  it('reorders slides on disk and returns the new order', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'reorder', index: 0, toIndex: 2, total: 3 })
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.ok).toBe(true)
    expect(reply.slides).toEqual(['AgendaSlide', 'ThankYouSlide', 'CoverSlide'])
    expect(config()).toMatch(/slides:\s*\[\s*AgendaSlide,\s*ThankYouSlide,\s*CoverSlide,/)
  })

  it('hides a slide and records it in hiddenSlides', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'hide', index: 1, hidden: true, total: 3 })
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.hiddenSlides).toEqual([1])
    expect(config()).toContain('hiddenSlides: [1],')
  })

  it('deletes a local slide, its files, and prunes the import', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'delete', index: 1, total: 3 })
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.removed.name).toBe('AgendaSlide')
    expect(reply.removed.kind).toBe('local')
    expect(reply.removed.files).toEqual([
      'src/slides/AgendaSlide.jsx',
      'src/slides/AgendaSlide.module.css',
    ])
    expect(existsSync(join(tempRoot, 'src', 'slides', 'AgendaSlide.jsx'))).toBe(false)
    expect(existsSync(join(tempRoot, 'src', 'slides', 'AgendaSlide.module.css'))).toBe(false)
    expect(config()).not.toContain('AgendaSlide')
    // Untouched files remain.
    expect(existsSync(join(tempRoot, 'src', 'slides', 'CoverSlide.jsx'))).toBe(true)
  })

  it('deletes an engine slide without touching the filesystem', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'delete', index: 2, total: 3 })
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.removed.kind).toBe('engine')
    expect(reply.removed.files).toEqual([])
    expect(config()).not.toContain('GenericThankYouSlide')
  })
})

describe('slide-ops middleware: guards', () => {
  it('rejects a stale total with 409', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'hide', index: 0, hidden: true, total: 99 })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).code).toBe('SLIDE_OP_STALE_SOURCE')
  })

  it('refuses to delete the last remaining slide', async () => {
    writeFileSync(join(tempRoot, 'deck.config.js'),
      `import CoverSlide from './src/slides/CoverSlide.jsx'\nexport default { slides: [CoverSlide] }\n`, 'utf8')
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'delete', index: 0 })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('SLIDE_OP_EMPTY_RESULT')
  })

  it('rejects an unknown op', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'nuke', index: 0 })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('SLIDE_OP_INVALID_OP')
  })

  it('rejects an out-of-range index', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'hide', index: 9, hidden: true })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('SLIDE_OP_INDEX_OUT_OF_RANGE')
  })

  it('refuses non-loopback clients', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq({ remoteAddress: '10.0.0.5' }); const res = new FakeRes()
    await drive(mw, req, res, { op: 'hide', index: 0, hidden: true })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).code).toBe('SLIDE_OP_REMOTE_CLIENT')
  })

  it('refuses when the dev server is network-exposed', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot, networkExposed: true })
    const req = new FakeReq(); const res = new FakeRes()
    await drive(mw, req, res, { op: 'hide', index: 0, hidden: true })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).code).toBe('SLIDE_OP_DISABLED_REMOTE_HOST')
  })

  it('refuses cross-origin requests', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq({ origin: 'http://evil.example.com' }); const res = new FakeRes()
    await drive(mw, req, res, { op: 'hide', index: 0, hidden: true })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).code).toBe('SLIDE_OP_CROSS_ORIGIN')
  })

  it('requires application/json', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq({ contentType: 'text/plain' }); const res = new FakeRes()
    await drive(mw, req, res, 'not json')
    expect(res.statusCode).toBe(415)
  })

  it('passes through non-matching urls to next()', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq({ url: '/something-else' }); const res = new FakeRes()
    const nextCalled = await drive(mw, req, res, undefined)
    expect(nextCalled).toBe(true)
    expect(res.ended).toBe(false)
  })

  it('accepts the launcher proxy-prefixed path', async () => {
    const mw = createSlideOpsMiddleware({ root: tempRoot })
    const req = new FakeReq({ url: '/preview/demo-123/__deckio/slide-op' }); const res = new FakeRes()
    await drive(mw, req, res, { op: 'hide', index: 0, hidden: true, total: 3 })
    expect(res.statusCode).toBe(200)
  })
})
