/**
 * Export deck slides to PowerPoint (.pptx) — direct download, no dialogs.
 *
 * Uses modern-screenshot (SVG foreignObject) + PptxGenJS.
 * Each slide is captured as a full-bleed image placed on a 10×5.625″ slide (16:9).
 */

const SETTLE_MS = 600

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function getCaptureSize(target, fallback) {
  const targetRect = target?.getBoundingClientRect?.()
  const fallbackRect = fallback?.getBoundingClientRect?.()

  const width = Math.max(1, Math.round(targetRect?.width || fallbackRect?.width || window.innerWidth || 1920))
  const height = Math.max(1, Math.round(targetRect?.height || fallbackRect?.height || window.innerHeight || 1080))

  return { width, height }
}

async function waitForAssets(root) {
  if (document.fonts?.ready) await document.fonts.ready

  const images = Array.from(root?.querySelectorAll('img') || [])
  await Promise.all(images.map(async (img) => {
    if (img.complete && img.naturalWidth > 0) return

    if (typeof img.decode === 'function') {
      try {
        await img.decode()
        return
      } catch {
        // Fall through to load/error listeners for assets decode cannot handle.
      }
    }

    await new Promise((resolve) => {
      const done = () => resolve()
      img.addEventListener('load', done, { once: true })
      img.addEventListener('error', done, { once: true })
    })
  }))
}

async function withExportMode(format, run) {
  const html = document.documentElement
  const prevMode = html.getAttribute('data-export-mode')
  const prevFormat = html.getAttribute('data-export-format')

  html.setAttribute('data-export-mode', 'capture')
  html.setAttribute('data-export-format', format)

  try {
    return await run()
  } finally {
    if (prevMode === null) html.removeAttribute('data-export-mode')
    else html.setAttribute('data-export-mode', prevMode)

    if (prevFormat === null) html.removeAttribute('data-export-format')
    else html.setAttribute('data-export-format', prevFormat)
  }
}

async function waitForPaint() {
  await new Promise((r) => requestAnimationFrame(() => r()))
  await new Promise((r) => requestAnimationFrame(() => r()))
}

function sanitize(v) {
  return String(v || 'deck').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck'
}

function buildFileName({ project, selectedCustomer }) {
  const base = selectedCustomer
    ? `${selectedCustomer} ${document.title || project || 'deck'}`
    : document.title || project || 'deck'
  return `${sanitize(base)}.pptx`
}

function pauseAnimations(slide) {
  const undo = []
  const pause = (el) => {
    const orig = el.style.animationPlayState
    el.style.animationPlayState = 'paused'
    undo.push(() => { el.style.animationPlayState = orig })
  }
  pause(slide)
  slide.querySelectorAll('*').forEach(pause)
  return () => { for (let i = undo.length - 1; i >= 0; i--) undo[i]() }
}

export async function exportDeckPptx({
  current,
  goTo,
  project,
  selectedCustomer,
  totalSlides,
  onProgress,
}) {
  const deck = document.querySelector('.deck')
  const slides = Array.from(deck?.querySelectorAll('.slide') || [])
  if (!deck || slides.length === 0) throw new Error('No slides found')

  const [{ domToPng }, PptxGenJS] = await Promise.all([
    import('modern-screenshot'),
    import('pptxgenjs'),
  ])
  const Pptx = PptxGenJS.default || PptxGenJS

  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--background').trim() || '#080b10'
  const scale = Math.min(window.devicePixelRatio || 1, 2)

  const initialActive = document.querySelector('.slide.active') || slides[current] || deck
  const initialCapture = getCaptureSize(initialActive, deck)
  const pptxWidth = 10
  const pptxHeight = Number((pptxWidth * initialCapture.height / initialCapture.width).toFixed(4))

  const pptx = new Pptx()
  pptx.defineLayout({ name: 'WIDE', width: pptxWidth, height: pptxHeight })
  pptx.layout = 'WIDE'

  await withExportMode('pptx', async () => {
    await waitForPaint()
    await wait(SETTLE_MS)
    await waitForAssets(deck)

    try {
      for (let i = 0; i < totalSlides; i++) {
        onProgress?.({ current: i + 1, total: totalSlides })
        goTo(i)
        await waitForPaint()
        await wait(SETTLE_MS)

        const active = document.querySelector('.slide.active') || slides[i]
        if (!active) throw new Error(`Slide ${i + 1} not found`)

        await waitForAssets(active)

        const capture = getCaptureSize(active, deck)

        const restore = pauseAnimations(active)
        await waitForPaint()

        let dataUrl
        try {
          dataUrl = await domToPng(active, {
            width: capture.width,
            height: capture.height,
            backgroundColor: bg,
            scale,
            style: {
              position: 'relative',
              inset: 'auto',
              left: '0',
              top: '0',
              width: `${capture.width}px`,
              height: `${capture.height}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              boxSizing: 'border-box',
              opacity: '1',
              transform: 'none',
              transition: 'none',
            },
          })
        } finally {
          restore()
        }

        const slide = pptx.addSlide()
        slide.background = { color: bg.replace('#', '') }
        slide.addImage({
          data: dataUrl,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
        })
      }
    } finally {
      goTo(current)
      await waitForPaint()
    }
  })

  const fileName = buildFileName({ project, selectedCustomer })
  await pptx.writeFile({ fileName })

  return { fileName }
}
