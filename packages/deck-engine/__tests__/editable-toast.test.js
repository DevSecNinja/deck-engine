/**
 * Editable global save-status toast — contract tests for the lifecycle
 * timings and status-copy surface (Anu inline-edit-toast acceptance).
 *
 * This suite is intentionally pure-JS: it locks the timing contract and
 * the public copy/exports of the new global toast surface without
 * needing a DOM. Field-local source-save expectations have been removed
 * from Editable; this file is the regression net for the move.
 */
import { describe, it, expect } from 'vitest'
import {
  TOAST_TIMINGS,
  TOAST_STATUS_TEXT,
  InlineEditProvider,
  EditableProvider,
  useInlineEdit,
  useInlineEditValue,
} from '../components/Editable.jsx'

describe('inline-edit toast — public surface', () => {
  it('exports the global save-status copy used by the bottom-right toast', () => {
    expect(TOAST_STATUS_TEXT).toEqual({
      saving: 'Saving…',
      saved: 'Saved to source',
      error: 'Couldn’t save.',
      conflict: 'Source changed. Refresh and try again.',
    })
  })

  it('does not include blocking field validation copy in the toast surface', () => {
    // "empty" is field-local because it blocks editing; it must not
    // appear in the global toast vocabulary.
    expect(TOAST_STATUS_TEXT).not.toHaveProperty('empty')
  })

  it('keeps InlineEditProvider as the canonical export and EditableProvider as alias', () => {
    expect(typeof InlineEditProvider).toBe('function')
    expect(EditableProvider).toBe(InlineEditProvider)
  })

  it('exposes the inline-edit hooks for consumer slides', () => {
    expect(typeof useInlineEdit).toBe('function')
    expect(typeof useInlineEditValue).toBe('function')
  })
})

describe('inline-edit toast — auto-dismiss timings (Anu acceptance)', () => {
  it('saved auto-dismisses in the 2–3s readable window', () => {
    expect(TOAST_TIMINGS.saved).toBeGreaterThanOrEqual(1500)
    expect(TOAST_TIMINGS.saved).toBeLessThanOrEqual(3000)
  })

  it('error persists in the 5–8s recoverable window', () => {
    expect(TOAST_TIMINGS.error).toBeGreaterThanOrEqual(4000)
    expect(TOAST_TIMINGS.error).toBeLessThanOrEqual(8000)
  })

  it('conflict persists until the next save / dismiss (no auto-dismiss)', () => {
    expect(TOAST_TIMINGS.conflict).toBe(0)
  })

  it('timings table is frozen so consumers cannot mutate the contract', () => {
    expect(Object.isFrozen(TOAST_TIMINGS)).toBe(true)
    expect(Object.isFrozen(TOAST_STATUS_TEXT)).toBe(true)
  })
})
