/**
 * nav-utils — pure, side-effect-free navigation math for SlideProvider.
 *
 * Extracted so the present/edit-mode + hidden-slide navigation rules can be
 * unit-tested in a plain Node environment (no DOM, no React) and stay
 * deterministic. SlideContext.jsx is a thin React wrapper over these.
 */

/**
 * Normalize a hiddenSlides array (authored in deck.config.js) into a sorted,
 * de-duplicated list of in-range integer indices.
 */
export function normalizeHidden(arr, total) {
  if (!Array.isArray(arr)) return []
  const set = new Set()
  for (const v of arr) {
    if (Number.isInteger(v) && v >= 0 && v < total) set.add(v)
  }
  return [...set].sort((a, b) => a - b)
}

/**
 * Absolute slide indices reachable in the given mode. Present mode drops
 * hidden slides; any other mode (edit) keeps every slide.
 */
export function computeVisibleIndices(totalSlides, hiddenSet, mode) {
  const out = []
  for (let i = 0; i < totalSlides; i++) {
    if (mode !== 'present' || !hiddenSet.has(i)) out.push(i)
  }
  return out
}

/**
 * Resolve a relative step (dir = +1 / -1) from `prev`.
 *   - edit (non-present): simple clamp over [0, totalSlides).
 *   - present: walk visibleIndices; if `prev` is hidden, jump to the nearest
 *     visible slide in the travel direction.
 * Returns the next absolute index (or `prev` if the move is not possible).
 */
export function stepVisible(prev, dir, visibleIndices, mode, totalSlides) {
  if (mode !== 'present') {
    const next = prev + dir
    return next < 0 || next >= totalSlides ? prev : next
  }
  if (visibleIndices.length === 0) return prev
  const pos = visibleIndices.indexOf(prev)
  if (pos === -1) {
    if (dir > 0) {
      const fwd = visibleIndices.find((i) => i > prev)
      return fwd != null ? fwd : prev
    }
    const back = [...visibleIndices].reverse().find((i) => i < prev)
    return back != null ? back : prev
  }
  const nextPos = pos + dir
  if (nextPos < 0 || nextPos >= visibleIndices.length) return prev
  return visibleIndices[nextPos]
}

/**
 * Resolve an absolute goTo target.
 *   - Out-of-range → null (caller ignores).
 *   - present mode + hidden target → nearest visible slide (forward first,
 *     else the last visible slide).
 *   - otherwise → the requested index.
 */
export function resolveGoTo(idx, mode, hiddenSet, visibleIndices, totalSlides) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= totalSlides) return null
  if (mode === 'present' && hiddenSet.has(idx)) {
    const fwd = visibleIndices.find((i) => i >= idx)
    if (fwd != null) return fwd
    return visibleIndices.length ? visibleIndices[visibleIndices.length - 1] : null
  }
  return idx
}

/**
 * If `current` lands on a hidden slide while in present mode, return the
 * visible slide it should snap to (forward first, else last visible). Returns
 * null when no snap is needed (or not possible).
 */
export function snapToVisible(current, mode, hiddenSet, visibleIndices, totalSlides) {
  if (mode !== 'present' || totalSlides === 0) return null
  if (!visibleIndices.length || !hiddenSet.has(current)) return null
  const fwd = visibleIndices.find((i) => i >= current)
  return fwd != null ? fwd : visibleIndices[visibleIndices.length - 1]
}

/**
 * Present-aware display metrics for Navigation / progress UI.
 */
export function displayMetrics(current, visibleIndices, mode, totalSlides) {
  const displayIndex = mode === 'present'
    ? Math.max(0, visibleIndices.indexOf(current))
    : current
  const visibleCount = visibleIndices.length || (mode === 'present' ? 0 : totalSlides)
  const progress = visibleCount > 0 ? ((displayIndex + 1) / visibleCount) * 100 : 0
  return {
    displayIndex,
    visibleCount,
    progress,
    atStart: displayIndex <= 0,
    atEnd: displayIndex >= visibleCount - 1,
    firstVisibleIndex: visibleIndices[0] ?? 0,
  }
}

/**
 * Resolve the *effective* navigation mode. Browser fullscreen forces present
 * behaviour (hidden slides skipped, edit affordances gone) regardless of the
 * authored/active mode, so a standalone deck shown fullscreen never reveals
 * slides the author hid. Outside fullscreen the active mode wins unchanged.
 */
export function resolveEffectiveMode(activeMode, isFullscreen) {
  return isFullscreen ? 'present' : activeMode
}

/**
 * Decide the initial edit/present mode from URL params + an explicit prop.
 * `search` is a location.search string; `isDev` is import.meta.env.DEV.
 */
export function resolveInitialMode(search, modeProp, isDev) {
  try {
    const params = new URLSearchParams(search || '')
    if (params.get('present') === '1') return 'present'
    if (params.get('edit') === '1') return 'edit'
  } catch {
    /* ignore */
  }
  if (modeProp === 'edit' || modeProp === 'present') return modeProp
  return isDev ? 'edit' : 'present'
}
