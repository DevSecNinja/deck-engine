import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const engineRoot = join(__dirname, '..')

function readEngineFile(...parts) {
  return readFileSync(join(engineRoot, ...parts), 'utf-8')
}

describe('export wiring', () => {
  it('routes PDF and PowerPoint through the shared export service', () => {
    const pdf = readEngineFile('components', 'exportDeckPdf.js')
    const pptx = readEngineFile('components', 'exportDeckPptx.js')

    expect(pdf).toContain("from './exportDeckService.js'")
    expect(pdf).toContain('unit: \'in\'')
    expect(pdf).toContain('getLayoutPageFormat(layout)')
    expect(pdf).toContain('captureSlidePng({')

    expect(pptx).toContain("from './exportDeckService.js'")
    expect(pptx).toContain('pptx.defineLayout({ name: layout.id')
    expect(pptx).toContain('w: layout.widthIn')
    expect(pptx).toContain('captureSlidePng({')
  })

  it('exposes size, fit, and quality controls from Navigation', () => {
    const source = readEngineFile('components', 'Navigation.jsx')

    expect(source).toContain('EXPORT_LAYOUTS')
    expect(source).toContain('EXPORT_FITS')
    expect(source).toContain('EXPORT_QUALITIES')
    expect(source).toContain('Export deck options')
    expect(source).toContain('exportOptions')
  })

  it('has export-mode CSS for fixed stage sizing and badge-safe capture', () => {
    const source = readEngineFile('styles', 'global.css')

    expect(source).toContain('html[data-export-mode="capture"]')
    expect(source).toContain('--deckio-export-width')
    expect(source).toContain('--deckio-export-fit-scale')
    expect(source).toContain('.deckio-editable')
    expect(source).toContain('[data-slot="badge"]')
    expect(source).toContain('overflow: visible !important')
  })
})
