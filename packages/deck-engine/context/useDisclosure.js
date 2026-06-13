import { useEffect, useState } from 'react'
import { useSlides } from './SlideContext.jsx'
import { useIsExporting } from './export-state.js'

/**
 * Progressive disclosure — the standard, export-safe step machine.
 *
 * This is the one blessed way to build "click to reveal" slides. It keeps the
 * tricky parts in the engine so every slide behaves identically and, crucially,
 * stays export-compatible:
 *
 *   • Live: forward keys (→ / Space / PageDown / Enter) advance one step while
 *     the slide is active; ← / PageUp step back. Events are intercepted in the
 *     capture phase and only allowed to bubble (and thus navigate to the next
 *     slide) once every step is revealed — so disclosure and navigation compose
 *     cleanly.
 *   • Export: while a PDF/PPTX capture is running (see useIsExporting) the hook
 *     reports the fully-revealed state and detaches its key listener, so the
 *     exported image always shows the slide's final state instead of its
 *     pre-disclosure (mostly-hidden) one. No per-deck wiring required.
 *
 * Usage:
 *
 *   const { step, isRevealed } = useDisclosure(items.length, { index })
 *   // i < step  →  item i is revealed
 *   items.map((it, i) => <Row className={isRevealed(i) ? 'in' : 'out'} />)
 *
 * Threshold-style slides can read `step` directly (e.g. `step >= 3`).
 *
 * @param {number} total - number of reveal steps (final step value).
 * @param {object} [options]
 * @param {number} [options.index] - this slide's index; when provided the hook
 *   only listens while `current === index`. Omit for always-active slides.
 * @param {number} [options.initial=0] - starting (and reset) step.
 * @returns {{
 *   step: number, total: number, isActive: boolean, exporting: boolean,
 *   atStart: boolean, atEnd: boolean, isRevealed: (i: number) => boolean,
 *   next: () => void, prev: () => void, setStep: (s: number) => void,
 * }}
 */
export function useDisclosure(total, options = {}) {
  const { index, initial = 0 } = options
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0))
  const safeInitial = Math.min(safeTotal, Math.max(0, Math.floor(Number(initial) || 0)))

  const { current } = useSlides()
  const exporting = useIsExporting()
  const isActive = index == null ? true : current === index
  const [step, setStep] = useState(safeInitial)

  // Reset to the initial step whenever the slide is left, so re-entering always
  // starts the disclosure from the top.
  useEffect(() => {
    if (!isActive) setStep(safeInitial)
  }, [isActive, safeInitial])

  useEffect(() => {
    if (!isActive || exporting) return
    const handler = (e) => {
      const forward = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Spacebar'
        || e.key === 'PageDown' || e.key === 'Enter'
      const backward = e.key === 'ArrowLeft' || e.key === 'PageUp'
      if (forward && step < safeTotal) {
        e.stopImmediatePropagation()
        e.preventDefault()
        setStep((s) => Math.min(safeTotal, s + 1))
      } else if (backward && step > safeInitial) {
        e.stopImmediatePropagation()
        e.preventDefault()
        setStep((s) => Math.max(safeInitial, s - 1))
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [isActive, exporting, step, safeTotal, safeInitial])

  const effectiveStep = exporting ? safeTotal : step

  return {
    step: effectiveStep,
    total: safeTotal,
    isActive,
    exporting,
    atStart: effectiveStep <= safeInitial,
    atEnd: effectiveStep >= safeTotal,
    isRevealed: (i) => i < effectiveStep,
    next: () => setStep((s) => Math.min(safeTotal, s + 1)),
    prev: () => setStep((s) => Math.max(safeInitial, s - 1)),
    setStep: (s) => setStep(() => Math.min(safeTotal, Math.max(safeInitial, Math.floor(Number(s) || 0)))),
  }
}
