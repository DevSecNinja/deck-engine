// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULTS,
  readState,
  shouldShow,
  evaluateForSession,
  markShown,
  markStarred,
  markSnoozed,
  markDismissed,
  STORAGE_KEY,
} from '../components/star-prompt-store.js'

function makeStore() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  }
}

const NOW = 1_000_000_000_000
const eligible = { v: 1, status: 'idle', sessions: 3, firstSeenAt: 1, lastShownAt: 0, snoozeUntil: 0 }

describe('star-prompt-store: readState', () => {
  it('returns an idle empty state when nothing is stored', () => {
    expect(readState(makeStore())).toMatchObject({ status: 'idle', sessions: 0 })
  })

  it('tolerates corrupt JSON without throwing', () => {
    const s = makeStore()
    s.setItem(STORAGE_KEY, '{not json')
    expect(readState(s)).toMatchObject({ status: 'idle', sessions: 0 })
  })
})

describe('star-prompt-store: shouldShow policy', () => {
  it('does not show before minSessions', () => {
    expect(shouldShow({ ...eligible, sessions: DEFAULTS.minSessions - 1 }, NOW, { random: () => 0 })).toBe(false)
  })

  it('shows once engaged, not snoozed, and the probability gate passes', () => {
    expect(shouldShow(eligible, NOW, { random: () => 0 })).toBe(true)
  })

  it('honours the probability gate', () => {
    expect(shouldShow(eligible, NOW, { random: () => 0.99 })).toBe(false)
  })

  it('never shows once starred or dismissed', () => {
    expect(shouldShow({ ...eligible, status: 'starred' }, NOW, { random: () => 0 })).toBe(false)
    expect(shouldShow({ ...eligible, status: 'dismissed' }, NOW, { random: () => 0 })).toBe(false)
  })

  it('respects an active snooze window', () => {
    expect(shouldShow({ ...eligible, snoozeUntil: NOW + 1000 }, NOW, { random: () => 0 })).toBe(false)
    expect(shouldShow({ ...eligible, snoozeUntil: NOW - 1000 }, NOW, { random: () => 0 })).toBe(true)
  })
})

describe('star-prompt-store: evaluateForSession', () => {
  let local
  let session
  beforeEach(() => {
    local = makeStore()
    session = makeStore()
  })

  it('counts exactly one session and caches the decision across calls', () => {
    local.setItem(STORAGE_KEY, JSON.stringify({ ...eligible, sessions: 2 }))
    const first = evaluateForSession(local, session, NOW, { random: () => 0 })
    expect(first).toBe(true)
    expect(readState(local).sessions).toBe(3)

    const second = evaluateForSession(local, session, NOW, { random: () => 0.99 })
    expect(second).toBe(true)
    expect(readState(local).sessions).toBe(3)
  })

  it('does not show on early sessions but still counts them', () => {
    expect(evaluateForSession(local, session, NOW, { random: () => 0 })).toBe(false)
    expect(readState(local).sessions).toBe(1)
  })
})

describe('star-prompt-store: actions', () => {
  it('markShown applies a cooldown even when ignored', () => {
    const s = makeStore()
    markShown(s, NOW)
    expect(readState(s).snoozeUntil).toBe(NOW + DEFAULTS.shownCooldownMs)
  })

  it('markStarred suppresses permanently', () => {
    const s = makeStore()
    markStarred(s, NOW)
    expect(readState(s).status).toBe('starred')
    expect(shouldShow(readState(s), NOW, { random: () => 0 })).toBe(false)
  })

  it('markSnoozed sets the snooze window', () => {
    const s = makeStore()
    markSnoozed(s, NOW)
    expect(readState(s).snoozeUntil).toBe(NOW + DEFAULTS.snoozeMs)
  })

  it('markDismissed suppresses permanently', () => {
    const s = makeStore()
    markDismissed(s, NOW)
    expect(readState(s).status).toBe('dismissed')
  })
})
