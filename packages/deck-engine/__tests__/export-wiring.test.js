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

  it('reveals progressive-disclosure steps and generalizes badge breathing room for capture', () => {
    const source = readEngineFile('styles', 'global.css')

    expect(source).toContain('.deck-steps-step')
    expect(source).toContain('[class*="badge" i]')
  })

  it('flattens gradient-clipped text before rasterizing each slide', () => {
    const service = readEngineFile('components', 'exportDeckService.js')

    expect(service).toContain('neutralizeClippedText(slide')
    expect(service).toContain('restoreClippedText()')
  })

  it('does not nuke gradient-clipped editable text with the background shorthand on export', () => {
    const source = readEngineFile('styles', 'global.css')

    // The export-mode editable reset must only clear the hover/active *color*
    // layer. Using the `background` shorthand also resets background-image and
    // background-clip, which turns gradient-clipped <Editable> headlines (e.g.
    // the GenericThankYouSlide "Thank You" title) fully transparent — and since
    // clip falls back to border-box, neutralizeClippedText no longer detects
    // them. Keep this as `background-color`.
    expect(source).toContain('background-color: transparent !important')
    expect(source).not.toContain('background: transparent !important')
  })

  it('forces every disclosure step visible during export via the engine hook', () => {
    const steps = readEngineFile('slides', 'GenericStepsSlide.jsx')
    const hook = readEngineFile('context', 'useDisclosure.js')
    const index = readEngineFile('index.js')

    // The blessed steps slide builds on the shared disclosure hook...
    expect(steps).toContain('useDisclosure')
    expect(steps).toContain('effectiveVisible')
    // ...which reveals every step while a capture is running.
    expect(hook).toContain('useIsExporting')
    expect(hook).toContain('exporting ? safeTotal')
    expect(index).toContain('useDisclosure')
    expect(index).toContain('useIsExporting')
  })

  it('drives hand-rolled disclosure slides to their final state during capture', () => {
    const service = readEngineFile('components', 'exportDeckService.js')
    const slideContext = readEngineFile('context', 'SlideContext.jsx')

    // Export pump: synthesize forward keys until the slide stops mutating.
    expect(service).toContain('revealDisclosureSteps(slide)')
    expect(service).toContain("key: 'ArrowRight'")
    // Navigation is suppressed during capture so an overshoot press past the
    // last step is a harmless no-op instead of advancing to the next slide.
    expect(slideContext).toContain('if (isExportingNow()) return')
  })

  it('settles in-flight reveals by finishing finite animations and pausing only infinite loops', () => {
    const service = readEngineFile('components', 'exportDeckService.js')

    // A disclosure reveal is a multi-hundred-ms opacity/transform transition.
    // The pump triggers it just before capture, so freezing it mid-flight bakes
    // a washed-out, half-faded frame into the export. pauseAnimations must
    // FINISH finite transitions/animations (snap to full opacity) and only
    // PAUSE infinite decorative loops.
    expect(service).toContain('getAnimations({ subtree: true })')
    expect(service).toContain('anim.finish()')
    expect(service).toContain('isInfiniteAnimation(anim)')
    expect(service).toContain('anim.pause()')
    // pauseAnimations still runs in the capture path before rasterizing.
    expect(service).toContain('const restoreAnimations = pauseAnimations(slide)')
  })
})
