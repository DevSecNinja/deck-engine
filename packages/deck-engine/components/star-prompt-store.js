/**
 * Throttled "star us on GitHub" prompt state for the engine's local-dev
 * authoring experience.
 *
 * Pure + storage-injectable so it unit-tests under the node environment without
 * a DOM. The component (GitHubStarPrompt.jsx) is a thin wrapper; all of the
 * "is it tasteful to ask right now?" policy lives here.
 *
 * Policy (industry-standard, deliberately non-spammy):
 *   - Never on first run. Only after `minSessions` distinct dev sessions, so we
 *     ask authors who have actually been building decks.
 *   - At most one decision per browser session (cached in sessionStorage), so
 *     HMR reloads / re-renders can't re-roll or flicker the prompt.
 *   - Showing it once quiets it for `shownCooldownMs` even if simply ignored.
 *   - "Maybe later" snoozes for `snoozeMs`. "Star" / "Don't show again" suppress
 *     it permanently.
 *   - A `probability` gate makes the ask feel organic rather than mechanical.
 *   - Every storage access is guarded; on any error we fail closed (never show)
 *     so a locked-down browser is never nagged or broken.
 */

export const STORAGE_KEY = 'deck:star-prompt'
export const SESSION_DECISION_KEY = 'deck:star-prompt:session'

const DAY = 24 * 60 * 60 * 1000

export const DEFAULTS = {
  minSessions: 3, // don't ask until the 3rd dev session — real engagement
  snoozeMs: 30 * DAY, // "maybe later" → ask again after 30 days
  shownCooldownMs: 14 * DAY, // showing once quiets it for 14 days
  probability: 0.5, // once eligible, ~50% per session so it feels organic
}

function emptyState() {
  return {
    v: 1,
    status: 'idle', // 'idle' | 'starred' | 'dismissed'
    sessions: 0,
    firstSeenAt: 0,
    lastShownAt: 0,
    snoozeUntil: 0,
  }
}

export function readState(storage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyState()
    return { ...emptyState(), ...parsed }
  } catch {
    return emptyState()
  }
}

export function writeState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage full / unavailable — ignore */
  }
  return state
}

/**
 * Pure predicate: given persisted state, should we show the prompt now?
 * `opts.random` (defaults to Math.random) is injectable for deterministic tests.
 */
export function shouldShow(state, now = Date.now(), opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  if (!state || state.status !== 'idle') return false
  if ((state.sessions || 0) < o.minSessions) return false
  if (now < (state.snoozeUntil || 0)) return false
  const rnd = typeof o.random === 'function' ? o.random() : Math.random()
  return rnd < o.probability
}

/**
 * Decide once per browser session whether to show the prompt, counting the
 * session toward engagement on first evaluation. Stable across re-renders /
 * HMR reloads within the same session (cached in sessionStorage).
 */
export function evaluateForSession(localStore, sessionStore, now = Date.now(), opts = {}) {
  let cached = null
  try {
    cached = sessionStore.getItem(SESSION_DECISION_KEY)
  } catch {
    /* ignore */
  }
  if (cached === '1' || cached === '0') return cached === '1'

  const prev = readState(localStore)
  const counted = {
    ...prev,
    sessions: (prev.sessions || 0) + 1,
    firstSeenAt: prev.firstSeenAt || now,
  }
  writeState(localStore, counted)

  const show = shouldShow(counted, now, opts)
  try {
    sessionStore.setItem(SESSION_DECISION_KEY, show ? '1' : '0')
  } catch {
    /* ignore */
  }
  return show
}

/** Record that the prompt was shown — quiets it for a cooldown even if ignored. */
export function markShown(storage, now = Date.now(), opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const state = readState(storage)
  return writeState(storage, {
    ...state,
    lastShownAt: now,
    snoozeUntil: Math.max(state.snoozeUntil || 0, now + o.shownCooldownMs),
  })
}

/** User starred the repo — never ask again. */
export function markStarred(storage, now = Date.now()) {
  const state = readState(storage)
  return writeState(storage, { ...state, status: 'starred', lastShownAt: now })
}

/** "Maybe later" — snooze for a while, then we may ask once more. */
export function markSnoozed(storage, now = Date.now(), opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const state = readState(storage)
  return writeState(storage, { ...state, snoozeUntil: now + o.snoozeMs, lastShownAt: now })
}

/** "Don't show again" — never ask again. */
export function markDismissed(storage, now = Date.now()) {
  const state = readState(storage)
  return writeState(storage, { ...state, status: 'dismissed', lastShownAt: now })
}
