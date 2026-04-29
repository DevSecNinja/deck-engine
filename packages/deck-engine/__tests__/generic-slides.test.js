import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('GenericThankYouSlide inline editing', () => {
  it('imports Editable', () => {
    const source = readFileSync(join(__dirname, '..', 'slides', 'GenericThankYouSlide.jsx'), 'utf-8')
    expect(source).toContain("import Editable from '../components/Editable.jsx'")
  })

  it('wraps title in Editable', () => {
    const source = readFileSync(join(__dirname, '..', 'slides', 'GenericThankYouSlide.jsx'), 'utf-8')
    expect(source).toContain('<Editable as="h2" id="thankYou.title"')
    expect(source).toContain('Thank You')
  })

  it('wraps subtitle in Editable', () => {
    const source = readFileSync(join(__dirname, '..', 'slides', 'GenericThankYouSlide.jsx'), 'utf-8')
    expect(source).toContain('<Editable as="p" id="thankYou.subtitle"')
  })

  it('wraps optional tagline in Editable', () => {
    const source = readFileSync(join(__dirname, '..', 'slides', 'GenericThankYouSlide.jsx'), 'utf-8')
    expect(source).toContain('<Editable as="p" id="thankYou.tagline"')
  })

  it('wraps optional footer in Editable within BottomBar', () => {
    const source = readFileSync(join(__dirname, '..', 'slides', 'GenericThankYouSlide.jsx'), 'utf-8')
    expect(source).toContain('footerText && <Editable as="span" id="thankYou.footer">')
  })

  it('does NOT wrap decorative watermark text', () => {
    const source = readFileSync(join(__dirname, '..', 'slides', 'GenericThankYouSlide.jsx'), 'utf-8')
    // The DECKIO watermark should NOT be wrapped
    const watermarkSpan = source.match(/<span className="deck-ty-watermark-text">DECKIO<\/span>/)
    expect(watermarkSpan).toBeTruthy()
    // Ensure it's not wrapped in Editable
    const watermarkSection = source.slice(
      source.indexOf('deck-ty-watermark'),
      source.indexOf('</div>', source.indexOf('deck-ty-watermark'))
    )
    expect(watermarkSection).not.toContain('<Editable')
  })
})
