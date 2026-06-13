import { describe, expect, it, afterEach } from 'vitest'
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_FITS,
  EXPORT_LAYOUTS,
  EXPORT_QUALITIES,
  buildExportFileName,
  getLayoutPageFormat,
  getPdfOrientation,
  neutralizeClippedText,
  normalizeHexColor,
  parseFirstGradientColor,
  resolveExportOptions,
  sanitizeFilePart,
  waitForAssets,
} from '../components/exportDeckService.js'

describe('exportDeckService presets', () => {
  afterEach(() => {
    delete globalThis.document
  })

  it('defaults to the common PowerPoint widescreen layout with high quality and auto fit', () => {
    const options = resolveExportOptions()

    expect(DEFAULT_EXPORT_OPTIONS).toEqual({
      layout: 'widescreen-16-9',
      quality: 'high',
      fit: 'auto',
    })
    expect(options.layout).toMatchObject({
      id: 'widescreen-16-9',
      widthIn: 13.333333,
      heightIn: 7.5,
      pixelWidth: 1920,
      pixelHeight: 1080,
    })
    expect(options.quality.scale).toBe(2)
    expect(options.fit.id).toBe('auto')
  })

  it('offers a small set of standard export sizes', () => {
    expect(EXPORT_LAYOUTS.map((layout) => layout.id)).toEqual([
      'widescreen-16-9',
      'standard-4-3',
      'a4-landscape',
      'letter-landscape',
    ])
  })

  it('offers explicit quality and fit controls', () => {
    expect(EXPORT_QUALITIES.map((quality) => [quality.id, quality.scale])).toEqual([
      ['high', 2],
      ['standard', 1],
    ])
    expect(EXPORT_FITS.map((fit) => fit.id)).toEqual(['auto', '1.2', '1', '0.9', '0.8'])
  })

  it('falls back safely when persisted or caller-provided options are stale', () => {
    const options = resolveExportOptions({
      layout: 'deleted-layout',
      quality: 'deleted-quality',
      fit: 'deleted-fit',
    })

    expect(options.layout.id).toBe(DEFAULT_EXPORT_OPTIONS.layout)
    expect(options.quality.id).toBe(DEFAULT_EXPORT_OPTIONS.quality)
    expect(options.fit.id).toBe(DEFAULT_EXPORT_OPTIONS.fit)
  })

  it('uses physical page dimensions for PDF and PPTX consumers', () => {
    const { layout } = resolveExportOptions({ layout: 'a4-landscape' })

    expect(getPdfOrientation(layout)).toBe('landscape')
    expect(getLayoutPageFormat(layout)).toEqual([11.6929, 8.2677])
  })

  it('normalizes background colors for PowerPoint', () => {
    expect(normalizeHexColor('#abc')).toBe('AABBCC')
    expect(normalizeHexColor('123456')).toBe('123456')
    expect(normalizeHexColor('not-a-color')).toBe('080B10')
  })

  it('builds stable file names for selected customers', () => {
    globalThis.document = { title: 'Quarterly Review' }

    expect(sanitizeFilePart('  Hello, Deck.io!  ')).toBe('hello-deck-io')
    expect(buildExportFileName({
      selectedCustomer: 'Contoso Ltd.',
      project: 'ignored',
      extension: 'pptx',
    })).toBe('contoso-ltd-quarterly-review.pptx')
  })

  it('does not hang when an image already failed before export starts', async () => {
    globalThis.document = {}
    const brokenCompleteImage = {
      complete: true,
      naturalWidth: 0,
      addEventListener() {
        throw new Error('complete images should not wait for future events')
      },
    }

    await expect(waitForAssets({
      querySelectorAll: () => [brokenCompleteImage],
    })).resolves.toBeUndefined()
  })
})

describe('parseFirstGradientColor', () => {
  it('pulls the first solid color out of a gradient for flattening clipped text', () => {
    expect(parseFirstGradientColor('linear-gradient(135deg, rgb(99, 102, 241), rgb(0, 0, 0))'))
      .toBe('rgb(99, 102, 241)')
    expect(parseFirstGradientColor('linear-gradient(90deg, rgba(16, 185, 129, 0.8) 0%, #000 100%)'))
      .toBe('rgba(16, 185, 129, 0.8)')
    expect(parseFirstGradientColor('radial-gradient(hsl(280, 90%, 60%), hsl(0, 0%, 0%))'))
      .toBe('hsl(280, 90%, 60%)')
    expect(parseFirstGradientColor('linear-gradient(#6366f1, #000000)')).toBe('#6366f1')
  })

  it('returns null when there is no usable color to flatten to', () => {
    expect(parseFirstGradientColor('none')).toBeNull()
    expect(parseFirstGradientColor('')).toBeNull()
    expect(parseFirstGradientColor(undefined)).toBeNull()
    expect(parseFirstGradientColor('url(image.png)')).toBeNull()
  })
})

describe('neutralizeClippedText', () => {
  const originalGetComputedStyle = globalThis.getComputedStyle
  const originalElement = globalThis.Element

  afterEach(() => {
    globalThis.getComputedStyle = originalGetComputedStyle
    globalThis.Element = originalElement
  })

  class FakeElement {
    constructor(computed) {
      this.style = {}
      this.__computed = computed
      this.children = []
    }
    querySelectorAll() {
      return this.children
    }
  }

  function install() {
    globalThis.Element = FakeElement
    globalThis.getComputedStyle = (el) => el.__computed
  }

  it('flattens gradient-clipped text to a solid color and restores afterward', () => {
    install()
    const clipped = new FakeElement({
      webkitBackgroundClip: 'text',
      backgroundClip: 'text',
      backgroundImage: 'linear-gradient(135deg, rgb(99, 102, 241), rgb(0, 0, 0))',
    })

    const restore = neutralizeClippedText(clipped, '#ffffff')

    expect(clipped.style.backgroundImage).toBe('none')
    expect(clipped.style.webkitTextFillColor).toBe('rgb(99, 102, 241)')
    expect(clipped.style.color).toBe('rgb(99, 102, 241)')

    restore()
    expect(clipped.style.backgroundImage).toBeUndefined()
    expect(clipped.style.webkitTextFillColor).toBeUndefined()
  })

  it('falls back to the provided color when no gradient color can be parsed', () => {
    install()
    const clipped = new FakeElement({
      webkitBackgroundClip: 'text',
      backgroundImage: 'none',
    })

    neutralizeClippedText(clipped, '#facc15')
    expect(clipped.style.webkitTextFillColor).toBe('#facc15')
    expect(clipped.style.color).toBe('#facc15')
  })

  it('leaves ordinary text untouched', () => {
    install()
    const plain = new FakeElement({
      webkitBackgroundClip: 'border-box',
      backgroundImage: 'none',
    })

    const restore = neutralizeClippedText(plain, '#ffffff')
    expect(plain.style).toEqual({})
    restore()
    expect(plain.style).toEqual({})
  })

  it('is a safe no-op when getComputedStyle is unavailable', () => {
    delete globalThis.getComputedStyle
    expect(() => neutralizeClippedText({}, '#ffffff')()).not.toThrow()
  })
})
