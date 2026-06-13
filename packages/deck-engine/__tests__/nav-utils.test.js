// @vitest-environment node
//
// Unit tests for the pure navigation math used by SlideProvider. Verifies the
// present/edit-mode + hidden-slide rules deterministically without a DOM.

import { describe, it, expect } from 'vitest'
import {
  normalizeHidden,
  computeVisibleIndices,
  stepVisible,
  resolveGoTo,
  snapToVisible,
  displayMetrics,
  resolveEffectiveMode,
  resolveInitialMode,
} from '../context/nav-utils.js'

const setOf = (...xs) => new Set(xs)

describe('normalizeHidden', () => {
  it('sorts, de-dupes, and drops out-of-range / non-integers', () => {
    expect(normalizeHidden([3, 1, 1, 9, -1, 2.5, 'x'], 5)).toEqual([1, 3])
  })
  it('returns [] for non-arrays', () => {
    expect(normalizeHidden(undefined, 5)).toEqual([])
    expect(normalizeHidden(null, 5)).toEqual([])
  })
})

describe('computeVisibleIndices', () => {
  it('keeps all slides in edit mode', () => {
    expect(computeVisibleIndices(4, setOf(1), 'edit')).toEqual([0, 1, 2, 3])
  })
  it('drops hidden slides in present mode', () => {
    expect(computeVisibleIndices(4, setOf(1, 2), 'present')).toEqual([0, 3])
  })
})

describe('stepVisible (edit mode)', () => {
  const vis = [0, 1, 2, 3]
  it('clamps at the ends', () => {
    expect(stepVisible(0, -1, vis, 'edit', 4)).toBe(0)
    expect(stepVisible(3, 1, vis, 'edit', 4)).toBe(3)
  })
  it('steps through every slide including hidden', () => {
    expect(stepVisible(0, 1, vis, 'edit', 4)).toBe(1)
    expect(stepVisible(2, -1, vis, 'edit', 4)).toBe(1)
  })
})

describe('stepVisible (present mode)', () => {
  // total 5, hide 1 and 3 → visible [0,2,4]
  const vis = [0, 2, 4]
  it('skips hidden slides forward', () => {
    expect(stepVisible(0, 1, vis, 'present', 5)).toBe(2)
    expect(stepVisible(2, 1, vis, 'present', 5)).toBe(4)
  })
  it('skips hidden slides backward', () => {
    expect(stepVisible(4, -1, vis, 'present', 5)).toBe(2)
    expect(stepVisible(2, -1, vis, 'present', 5)).toBe(0)
  })
  it('clamps at the visible ends', () => {
    expect(stepVisible(0, -1, vis, 'present', 5)).toBe(0)
    expect(stepVisible(4, 1, vis, 'present', 5)).toBe(4)
  })
  it('jumps to nearest visible when starting on a hidden slide', () => {
    expect(stepVisible(1, 1, vis, 'present', 5)).toBe(2) // forward → 2
    expect(stepVisible(3, -1, vis, 'present', 5)).toBe(2) // backward → 2
    expect(stepVisible(1, -1, vis, 'present', 5)).toBe(0)
  })
  it('returns prev when there are no visible slides', () => {
    expect(stepVisible(2, 1, [], 'present', 5)).toBe(2)
  })
})

describe('resolveGoTo', () => {
  const vis = [0, 2, 4]
  const hidden = setOf(1, 3)
  it('returns null for out-of-range', () => {
    expect(resolveGoTo(-1, 'present', hidden, vis, 5)).toBeNull()
    expect(resolveGoTo(5, 'present', hidden, vis, 5)).toBeNull()
  })
  it('passes through a visible target in present mode', () => {
    expect(resolveGoTo(2, 'present', hidden, vis, 5)).toBe(2)
  })
  it('snaps a hidden target forward to nearest visible', () => {
    expect(resolveGoTo(1, 'present', hidden, vis, 5)).toBe(2)
    expect(resolveGoTo(3, 'present', hidden, vis, 5)).toBe(4)
  })
  it('snaps to last visible when no forward visible exists', () => {
    // hide the tail: total 4, visible [0,1], target 3 (hidden)
    expect(resolveGoTo(3, 'present', setOf(2, 3), [0, 1], 4)).toBe(1)
  })
  it('allows hidden targets in edit mode', () => {
    expect(resolveGoTo(1, 'edit', hidden, [0, 1, 2, 3, 4], 5)).toBe(1)
  })
})

describe('snapToVisible', () => {
  const vis = [0, 2, 4]
  const hidden = setOf(1, 3)
  it('returns null in edit mode', () => {
    expect(snapToVisible(1, 'edit', hidden, vis, 5)).toBeNull()
  })
  it('returns null when current is already visible', () => {
    expect(snapToVisible(2, 'present', hidden, vis, 5)).toBeNull()
  })
  it('snaps a hidden current forward', () => {
    expect(snapToVisible(1, 'present', hidden, vis, 5)).toBe(2)
  })
  it('snaps to last visible when current is past all visible', () => {
    expect(snapToVisible(3, 'present', setOf(3), [0, 1, 2], 4)).toBe(2)
  })
})

describe('displayMetrics', () => {
  it('edit mode reflects absolute position over all slides', () => {
    const m = displayMetrics(2, [0, 1, 2, 3], 'edit', 4)
    expect(m.displayIndex).toBe(2)
    expect(m.visibleCount).toBe(4)
    expect(m.progress).toBe(75)
    expect(m.atStart).toBe(false)
    expect(m.atEnd).toBe(false)
    expect(m.firstVisibleIndex).toBe(0)
  })
  it('present mode reflects position among visible slides', () => {
    const m = displayMetrics(4, [0, 2, 4], 'present', 5)
    expect(m.displayIndex).toBe(2) // 4 is the 3rd visible
    expect(m.visibleCount).toBe(3)
    expect(m.progress).toBeCloseTo(100)
    expect(m.atEnd).toBe(true)
    expect(m.firstVisibleIndex).toBe(0)
  })
  it('marks atStart on the first visible slide when slide 0 is hidden', () => {
    const m = displayMetrics(1, [1, 3], 'present', 4)
    expect(m.displayIndex).toBe(0)
    expect(m.atStart).toBe(true)
    expect(m.firstVisibleIndex).toBe(1)
  })
})

describe('resolveInitialMode', () => {
  it('honors ?present=1 and ?edit=1', () => {
    expect(resolveInitialMode('?present=1', undefined, true)).toBe('present')
    expect(resolveInitialMode('?edit=1', undefined, false)).toBe('edit')
  })
  it('falls back to the prop', () => {
    expect(resolveInitialMode('', 'present', true)).toBe('present')
  })
  it('defaults to edit in dev and present in prod', () => {
    expect(resolveInitialMode('', undefined, true)).toBe('edit')
    expect(resolveInitialMode('', undefined, false)).toBe('present')
  })
})

describe('resolveEffectiveMode', () => {
  it('forces present while fullscreen, regardless of active mode', () => {
    expect(resolveEffectiveMode('edit', true)).toBe('present')
    expect(resolveEffectiveMode('present', true)).toBe('present')
  })
  it('passes the active mode through when not fullscreen', () => {
    expect(resolveEffectiveMode('edit', false)).toBe('edit')
    expect(resolveEffectiveMode('present', false)).toBe('present')
  })
})
