import { describe, expect, it, afterEach } from 'vitest'
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_FITS,
  EXPORT_LAYOUTS,
  EXPORT_QUALITIES,
  buildExportFileName,
  getLayoutPageFormat,
  getPdfOrientation,
  normalizeHexColor,
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
