import { useState, useEffect } from 'react'

/**
 * Export-state signal.
 *
 * While a PDF/PPTX capture is running the engine sets
 * `data-export-mode="capture"` on <html> (see exportDeckService.withExportMode).
 * Slides that gate content behind progressive disclosure (or any other
 * "reveal over time" interaction) can subscribe to this signal and render
 * their fully-revealed state during capture so the exported image matches the
 * slide's final state instead of its initial one.
 */

const EXPORT_ATTR = 'data-export-mode'
const CAPTURE = 'capture'

export function isExportingNow() {
  return typeof document !== 'undefined'
    && document.documentElement.getAttribute(EXPORT_ATTR) === CAPTURE
}

/**
 * React hook returning `true` while the deck is being captured for export.
 *
 *   const exporting = useIsExporting()
 *   const visible = exporting ? steps.length : visibleCount
 *
 * Reveal everything during export so progressive-disclosure slides export
 * their final state.
 */
export function useIsExporting() {
  const [exporting, setExporting] = useState(isExportingNow)

  useEffect(() => {
    const el = document.documentElement
    const update = () => setExporting(el.getAttribute(EXPORT_ATTR) === CAPTURE)
    update()
    const observer = new MutationObserver(update)
    observer.observe(el, { attributes: true, attributeFilter: [EXPORT_ATTR] })
    return () => observer.disconnect()
  }, [])

  return exporting
}
