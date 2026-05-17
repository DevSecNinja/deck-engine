/**
 * Regression tests for the InlineEditContext extraction + EditableToolbar
 * wiring. The toolbar reads ctx via useContext, which means there must be
 * exactly ONE InlineEditContext identity shared between Editable.jsx and
 * EditableToolbar.jsx. A second `createContext()` call would silently
 * cause the toolbar to never see the provider value.
 */
import { describe, it, expect } from 'vitest'
import { InlineEditContext as ContextFromModule } from '../components/editable-context.js'
import { InlineEditContext as ContextFromEditable } from '../components/Editable.jsx'
import EditableToolbar from '../components/EditableToolbar.jsx'
import * as deckEngine from '../index.js'

describe('InlineEditContext extraction', () => {
  it('is the same context identity whether imported from the dedicated module or re-exported from Editable.jsx', () => {
    // If these diverge, the toolbar's useContext(InlineEditContext) call
    // would always return null even when the provider is mounted.
    expect(ContextFromModule).toBe(ContextFromEditable)
  })

  it('exposes a Provider on the context', () => {
    // React's createContext() returns an object with .Provider; the exact
    // type (function vs object) differs across React versions.
    expect(ContextFromModule.Provider).toBeDefined()
  })
})

describe('EditableToolbar public surface', () => {
  it('is exported as a function component', () => {
    expect(typeof EditableToolbar).toBe('function')
  })

  it('is re-exported from the package entry point', () => {
    expect(deckEngine.EditableToolbar).toBe(EditableToolbar)
  })
})
