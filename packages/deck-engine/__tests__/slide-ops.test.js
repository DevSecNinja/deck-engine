// @vitest-environment node
//
// Unit tests for the deterministic deck.config.js slide codemods.
// Covers parse, reorder (+ hidden remap), delete (local/engine/duplicate,
// import pruning, file reporting, hidden remap), and setHidden (insert/toggle).

import { describe, it, expect } from 'vitest'
import {
  parseDeckConfig,
  reorderSlides,
  deleteSlide,
  setSlideHidden,
  SLIDE_OP_ERROR_CODES,
} from '../server/slide-ops.mjs'

const BASE = `import CoverSlide from './src/slides/CoverSlide.jsx'
import WelcomeSlide from './src/slides/WelcomeSlide.jsx'
import DeepSlide from './src/slides/chapter1/DeepSlide.jsx'
import { GenericThankYouSlide as ThankYouSlide } from '@deckio/deck-engine'

export default {
  id: 'demo',
  title: 'Demo',
  accent: '#f59e0b',
  slides: [
    CoverSlide,
    WelcomeSlide,
    DeepSlide,
    ThankYouSlide,
  ],
}
`

describe('parseDeckConfig', () => {
  it('parses slide identifiers in order', () => {
    const { slides, hidden } = parseDeckConfig(BASE)
    expect(slides).toEqual(['CoverSlide', 'WelcomeSlide', 'DeepSlide', 'ThankYouSlide'])
    expect(hidden).toEqual([])
  })

  it('parses an existing hiddenSlides array', () => {
    const text = BASE.replace('  slides:', '  hiddenSlides: [1, 3],\n  slides:')
    expect(parseDeckConfig(text).hidden).toEqual([1, 3])
  })

  it('ignores comments inside the slides array', () => {
    const text = BASE.replace('    CoverSlide,', '    CoverSlide, // the cover\n    // a comment line')
    expect(parseDeckConfig(text).slides[0]).toBe('CoverSlide')
  })

  it('throws UNSUPPORTED_CONFIG for non-identifier entries', () => {
    const text = BASE.replace('    CoverSlide,', '    () => <div/>,')
    expect(() => parseDeckConfig(text)).toThrowError(/UNSUPPORTED_CONFIG/)
  })

  it('throws NO_SLIDES_ARRAY when slides is missing', () => {
    expect(() => parseDeckConfig('export default { id: "x" }')).toThrowError(/NO_SLIDES_ARRAY/)
  })
})

describe('reorderSlides', () => {
  it('moves an entry forward', () => {
    const { text } = reorderSlides(BASE, 0, 2)
    expect(parseDeckConfig(text).slides).toEqual(['WelcomeSlide', 'DeepSlide', 'CoverSlide', 'ThankYouSlide'])
  })

  it('moves an entry backward', () => {
    const { text } = reorderSlides(BASE, 3, 1)
    expect(parseDeckConfig(text).slides).toEqual(['CoverSlide', 'ThankYouSlide', 'WelcomeSlide', 'DeepSlide'])
  })

  it('is a no-op when from === to', () => {
    const { text } = reorderSlides(BASE, 1, 1)
    expect(text).toBe(BASE)
  })

  it('remaps hidden indices through the move (forward)', () => {
    const withHidden = setSlideHidden(BASE, 1, true).text // hide WelcomeSlide (idx 1)
    const { text } = reorderSlides(withHidden, 1, 3) // move WelcomeSlide to end
    const { slides, hidden } = parseDeckConfig(text)
    expect(slides).toEqual(['CoverSlide', 'DeepSlide', 'ThankYouSlide', 'WelcomeSlide'])
    expect(hidden).toEqual([3]) // hidden mark followed WelcomeSlide
  })

  it('remaps hidden indices through the move (backward)', () => {
    const withHidden = setSlideHidden(BASE, 3, true).text // hide ThankYouSlide (idx 3)
    const { text } = reorderSlides(withHidden, 3, 0) // move it to front
    expect(parseDeckConfig(text).hidden).toEqual([0])
  })

  it('preserves unrelated config content', () => {
    const { text } = reorderSlides(BASE, 0, 1)
    expect(text).toContain("id: 'demo'")
    expect(text).toContain("accent: '#f59e0b'")
  })

  it('throws on out-of-range index', () => {
    expect(() => reorderSlides(BASE, 0, 9)).toThrowError(/INDEX_OUT_OF_RANGE/)
  })
})

describe('deleteSlide', () => {
  it('removes a local slide entry, its import, and reports files', () => {
    const { text, removedName, kind, filesToDelete } = deleteSlide(BASE, 1)
    expect(removedName).toBe('WelcomeSlide')
    expect(kind).toBe('local')
    expect(parseDeckConfig(text).slides).toEqual(['CoverSlide', 'DeepSlide', 'ThankYouSlide'])
    expect(text).not.toContain("import WelcomeSlide")
    expect(filesToDelete).toEqual(['src/slides/WelcomeSlide.jsx', 'src/slides/WelcomeSlide.module.css'])
  })

  it('reports nested local slide paths correctly', () => {
    const { filesToDelete } = deleteSlide(BASE, 2) // DeepSlide in chapter1/
    expect(filesToDelete).toEqual([
      'src/slides/chapter1/DeepSlide.jsx',
      'src/slides/chapter1/DeepSlide.module.css',
    ])
  })

  it('removes an engine named specifier without reporting files', () => {
    const { text, kind, filesToDelete } = deleteSlide(BASE, 3) // ThankYouSlide (engine)
    expect(kind).toBe('engine')
    expect(filesToDelete).toEqual([])
    // The named import specifier is pruned; statement removed since it was the only one.
    expect(text).not.toContain('GenericThankYouSlide')
  })

  it('keeps the import + files when the component is still used (duplicate)', () => {
    const dup = BASE.replace('    ThankYouSlide,', '    ThankYouSlide,\n    CoverSlide,')
    // dup slides: [Cover, Welcome, Deep, ThankYou, Cover]; delete first Cover (idx 0)
    const { text, filesToDelete } = deleteSlide(dup, 0)
    expect(filesToDelete).toEqual([]) // CoverSlide still used at the end
    expect(text).toContain("import CoverSlide")
    expect(parseDeckConfig(text).slides).toEqual(['WelcomeSlide', 'DeepSlide', 'ThankYouSlide', 'CoverSlide'])
  })

  it('remaps hidden indices when deleting', () => {
    const withHidden = setSlideHidden(BASE, 3, true).text // hide ThankYouSlide (idx 3)
    const { text } = deleteSlide(withHidden, 1) // delete WelcomeSlide (idx 1)
    expect(parseDeckConfig(text).hidden).toEqual([2]) // 3 shifted down to 2
  })

  it('drops the hidden mark for the deleted slide', () => {
    const withHidden = setSlideHidden(BASE, 1, true).text
    const { text } = deleteSlide(withHidden, 1)
    expect(parseDeckConfig(text).hidden).toEqual([])
  })

  it('keeps a multi-specifier engine import intact when removing one', () => {
    const multi = BASE
      .replace(
        "import { GenericThankYouSlide as ThankYouSlide } from '@deckio/deck-engine'",
        "import { GenericThankYouSlide as ThankYouSlide, GenericAgendaSlide } from '@deckio/deck-engine'",
      )
      .replace('    ThankYouSlide,', '    ThankYouSlide,\n    GenericAgendaSlide,')
    const { text } = deleteSlide(multi, 3) // remove ThankYouSlide
    expect(text).toContain('GenericAgendaSlide')
    expect(text).not.toContain('ThankYouSlide')
  })
})

describe('setSlideHidden', () => {
  it('inserts a hiddenSlides field when none exists', () => {
    const { text, hidden } = setSlideHidden(BASE, 2, true)
    expect(hidden).toEqual([2])
    expect(text).toContain('hiddenSlides: [2],')
    expect(parseDeckConfig(text).hidden).toEqual([2])
  })

  it('adds to an existing hiddenSlides field, kept sorted', () => {
    const once = setSlideHidden(BASE, 2, true).text
    const twice = setSlideHidden(once, 0, true).text
    expect(parseDeckConfig(twice).hidden).toEqual([0, 2])
  })

  it('removes an index and empties the field', () => {
    const once = setSlideHidden(BASE, 2, true).text
    const { text, hidden } = setSlideHidden(once, 2, false)
    expect(hidden).toEqual([])
    expect(parseDeckConfig(text).hidden).toEqual([])
  })

  it('is idempotent', () => {
    const a = setSlideHidden(BASE, 1, true).text
    const b = setSlideHidden(a, 1, true).text
    expect(parseDeckConfig(b).hidden).toEqual([1])
  })

  it('throws on out-of-range index', () => {
    expect(() => setSlideHidden(BASE, 9, true)).toThrowError(/INDEX_OUT_OF_RANGE/)
  })
})

describe('error codes', () => {
  it('exposes stable codes', () => {
    expect(SLIDE_OP_ERROR_CODES.UNSUPPORTED_CONFIG).toBe('SLIDE_OP_UNSUPPORTED_CONFIG')
    expect(SLIDE_OP_ERROR_CODES.INDEX_OUT_OF_RANGE).toBe('SLIDE_OP_INDEX_OUT_OF_RANGE')
  })
})
