import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(join(__dirname, '..', ...p), 'utf-8')

describe('useDisclosure — standard progressive-disclosure hook', () => {
  const src = read('context', 'useDisclosure.js')

  it('derives active + exporting state from the engine', () => {
    expect(src).toContain("import { useSlides } from './SlideContext.jsx'")
    expect(src).toContain("import { useIsExporting } from './export-state.js'")
    expect(src).toContain('const isActive = index == null ? true : current === index')
  })

  it('reveals every step while exporting and detaches the key listener', () => {
    // The whole point: captures show the final, fully-disclosed state.
    expect(src).toContain('const effectiveStep = exporting ? safeTotal : step')
    expect(src).toContain('if (!isActive || exporting) return')
  })

  it('resets to the initial step when the slide is left', () => {
    expect(src).toContain('if (!isActive) setStep(safeInitial)')
  })

  it('intercepts forward/back keys in the capture phase before navigation', () => {
    expect(src).toContain("e.key === 'ArrowRight'")
    expect(src).toContain('stopImmediatePropagation')
    expect(src).toContain('{ capture: true }')
  })

  it('clamps step to the [initial, total] range', () => {
    expect(src).toContain('Math.min(safeTotal, s + 1)')
    expect(src).toContain('Math.max(safeInitial, s - 1)')
  })

  it('is exported from the engine entrypoint', () => {
    expect(read('index.js')).toContain('export { useDisclosure }')
  })
})
