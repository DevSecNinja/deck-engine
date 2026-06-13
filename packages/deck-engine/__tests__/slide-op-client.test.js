// @vitest-environment node
//
// Unit tests for the slide-op client helper (endpoint resolution + POST).

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  resolveSlideOpEndpoint,
  callSlideOp,
  SLIDE_OP_ENDPOINT_SUFFIX,
} from '../components/slide-op-client.js'

afterEach(() => {
  vi.restoreAllMocks()
  delete globalThis.fetch
})

describe('resolveSlideOpEndpoint', () => {
  it('joins a root base URL', () => {
    expect(resolveSlideOpEndpoint('/')).toBe(`/${SLIDE_OP_ENDPOINT_SUFFIX}`)
  })
  it('joins a launcher proxy sub-path base and adds a trailing slash', () => {
    expect(resolveSlideOpEndpoint('/preview/demo-123')).toBe(`/preview/demo-123/${SLIDE_OP_ENDPOINT_SUFFIX}`)
  })
  it('preserves an existing trailing slash', () => {
    expect(resolveSlideOpEndpoint('/preview/demo-123/')).toBe(`/preview/demo-123/${SLIDE_OP_ENDPOINT_SUFFIX}`)
  })
  it('falls back to root for empty input', () => {
    expect(resolveSlideOpEndpoint('')).toBe(`/${SLIDE_OP_ENDPOINT_SUFFIX}`)
  })
})

describe('callSlideOp', () => {
  it('POSTs JSON and returns ok on a successful reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, total: 3, hiddenSlides: [1] }),
    })
    globalThis.fetch = fetchMock
    const out = await callSlideOp({ op: 'hide', index: 1, hidden: true }, '/x/__deckio/slide-op')
    expect(out.ok).toBe(true)
    expect(out.status).toBe(200)
    expect(out.data.hiddenSlides).toEqual([1])
    expect(fetchMock).toHaveBeenCalledWith('/x/__deckio/slide-op', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }))
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toEqual({ op: 'hide', index: 1, hidden: true })
  })

  it('returns ok:false when the server reports an error code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, code: 'SLIDE_OP_STALE_SOURCE' }),
    })
    const out = await callSlideOp({ op: 'delete', index: 0 }, '/x/__deckio/slide-op')
    expect(out.ok).toBe(false)
    expect(out.status).toBe(409)
    expect(out.data.code).toBe('SLIDE_OP_STALE_SOURCE')
  })

  it('returns a network error result when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom'))
    const out = await callSlideOp({ op: 'hide', index: 0, hidden: true }, '/x/__deckio/slide-op')
    expect(out.ok).toBe(false)
    expect(out.status).toBe(0)
    expect(out.error).toBe('network')
  })
})
