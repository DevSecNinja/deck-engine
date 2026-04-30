const SETTLE_MS = 600

export const EXPORT_LAYOUTS = Object.freeze([
  {
    id: 'widescreen-16-9',
    label: 'Widescreen 16:9',
    hint: 'PowerPoint default',
    widthIn: 13.333333,
    heightIn: 7.5,
    pixelWidth: 1920,
    pixelHeight: 1080,
  },
  {
    id: 'standard-4-3',
    label: 'Standard 4:3',
    hint: 'Classic projector',
    widthIn: 10,
    heightIn: 7.5,
    pixelWidth: 1600,
    pixelHeight: 1200,
  },
  {
    id: 'a4-landscape',
    label: 'A4 landscape',
    hint: 'PDF handout',
    widthIn: 11.6929,
    heightIn: 8.2677,
    pixelWidth: 1920,
    pixelHeight: 1358,
  },
  {
    id: 'letter-landscape',
    label: 'Letter landscape',
    hint: 'US handout',
    widthIn: 11,
    heightIn: 8.5,
    pixelWidth: 1650,
    pixelHeight: 1275,
  },
])

export const EXPORT_QUALITIES = Object.freeze([
  { id: 'high', label: 'High', hint: '2x pixels', scale: 2 },
  { id: 'standard', label: 'Standard', hint: 'smaller file', scale: 1 },
])

export const EXPORT_FITS = Object.freeze([
  { id: 'auto', label: 'Auto fit', hint: 'shrinks busy slides only' },
  { id: '1.2', label: '120%', hint: 'zoomed in', scale: 1.2 },
  { id: '1', label: '100%', hint: 'source size', scale: 1 },
  { id: '0.9', label: '90%', hint: 'slightly tighter', scale: 0.9 },
  { id: '0.8', label: '80%', hint: 'busy slides', scale: 0.8 },
])

export const DEFAULT_EXPORT_OPTIONS = Object.freeze({
  layout: 'widescreen-16-9',
  quality: 'high',
  fit: 'auto',
})

const AUTO_FIT_SCALES = Object.freeze([1, 0.95, 0.9, 0.85, 0.8])

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function byId(items, id, fallbackId) {
  return items.find((item) => item.id === id)
    || items.find((item) => item.id === fallbackId)
    || items[0]
}

export function resolveExportOptions(options = {}) {
  const layout = byId(EXPORT_LAYOUTS, options.layout, DEFAULT_EXPORT_OPTIONS.layout)
  const quality = byId(EXPORT_QUALITIES, options.quality, DEFAULT_EXPORT_OPTIONS.quality)
  const fit = byId(EXPORT_FITS, options.fit, DEFAULT_EXPORT_OPTIONS.fit)
  return { layout, quality, fit }
}

export function getPdfOrientation(layout) {
  return layout.widthIn >= layout.heightIn ? 'landscape' : 'portrait'
}

export function getLayoutPageFormat(layout) {
  return [layout.widthIn, layout.heightIn]
}

export function getSlideBackground() {
  const styles = getComputedStyle(document.documentElement)
  return styles.getPropertyValue('--background').trim() || '#080b10'
}

export function normalizeHexColor(value, fallback = '080B10') {
  const raw = String(value || '').trim()
  const short = raw.match(/^#?([0-9a-f]{3})$/i)
  if (short) {
    return short[1].split('').map((c) => c + c).join('').toUpperCase()
  }
  const long = raw.match(/^#?([0-9a-f]{6})$/i)
  return long ? long[1].toUpperCase() : fallback
}

export function sanitizeFilePart(v) {
  return String(v || 'deck').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck'
}

export function buildExportFileName({ project, selectedCustomer, extension }) {
  const base = selectedCustomer
    ? `${selectedCustomer} ${document.title || project || 'deck'}`
    : document.title || project || 'deck'
  return `${sanitizeFilePart(base)}.${extension}`
}

export async function waitForPaint() {
  await new Promise((r) => requestAnimationFrame(() => r()))
  await new Promise((r) => requestAnimationFrame(() => r()))
}

export async function settleExportFrame() {
  await waitForPaint()
  await wait(SETTLE_MS)
}

export async function waitForAssets(root) {
  if (document.fonts?.ready) await document.fonts.ready

  const images = Array.from(root?.querySelectorAll('img') || [])
  await Promise.all(images.map(async (img) => {
    if (img.complete) return

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

export async function withExportMode(format, run) {
  const html = document.documentElement
  const prevMode = html.getAttribute('data-export-mode')
  const prevFormat = html.getAttribute('data-export-format')
  const prevWidth = html.style.getPropertyValue('--deckio-export-width')
  const prevHeight = html.style.getPropertyValue('--deckio-export-height')
  const prevFit = html.style.getPropertyValue('--deckio-export-fit-scale')

  html.setAttribute('data-export-mode', 'capture')
  html.setAttribute('data-export-format', format)

  try {
    return await run()
  } finally {
    if (prevMode === null) html.removeAttribute('data-export-mode')
    else html.setAttribute('data-export-mode', prevMode)

    if (prevFormat === null) html.removeAttribute('data-export-format')
    else html.setAttribute('data-export-format', prevFormat)

    restoreCssVar(html, '--deckio-export-width', prevWidth)
    restoreCssVar(html, '--deckio-export-height', prevHeight)
    restoreCssVar(html, '--deckio-export-fit-scale', prevFit)
  }
}

function restoreCssVar(el, name, value) {
  if (value) el.style.setProperty(name, value)
  else el.style.removeProperty(name)
}

function saveInlineStyles(el, props) {
  if (!el) return () => {}
  const previous = props.map((prop) => [prop, el.style[prop]])
  return () => {
    previous.forEach(([prop, value]) => {
      el.style[prop] = value
    })
  }
}

function applyStyles(el, styles) {
  if (!el) return
  Object.assign(el.style, styles)
}

function prepareExportStage(deck, slide, layout) {
  const html = document.documentElement
  const body = document.body
  const root = document.getElementById('root')
  const size = {
    width: `${layout.pixelWidth}px`,
    height: `${layout.pixelHeight}px`,
  }
  const restores = [
    saveInlineStyles(html, ['width', 'height', 'overflow']),
    saveInlineStyles(body, ['width', 'height', 'overflow']),
    saveInlineStyles(root, ['width', 'height', 'overflow']),
    saveInlineStyles(deck, ['width', 'height', 'overflow', 'position']),
    saveInlineStyles(slide, [
      'width',
      'height',
      'position',
      'inset',
      'left',
      'top',
      'opacity',
      'visibility',
      'pointerEvents',
      'transform',
      'transition',
      'maxWidth',
      'maxHeight',
      'boxSizing',
    ]),
  ]

  html.style.setProperty('--deckio-export-width', size.width)
  html.style.setProperty('--deckio-export-height', size.height)

  applyStyles(html, { ...size, overflow: 'hidden' })
  applyStyles(body, { ...size, overflow: 'hidden' })
  applyStyles(root, { ...size, overflow: 'hidden' })
  applyStyles(deck, { ...size, overflow: 'hidden', position: 'relative' })
  applyStyles(slide, {
    ...size,
    position: 'relative',
    inset: 'auto',
    left: '0',
    top: '0',
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'auto',
    transform: 'none',
    transition: 'none',
    maxWidth: 'none',
    maxHeight: 'none',
    boxSizing: 'border-box',
  })

  return () => {
    for (let i = restores.length - 1; i >= 0; i--) restores[i]()
  }
}

function isMeasurableSlideChild(child) {
  if (!(child instanceof Element)) return false
  if (child.matches('.slide-overflow-warn, [data-export-ignore="true"]')) return false
  const styles = getComputedStyle(child)
  if (styles.display === 'none' || styles.visibility === 'hidden') return false
  if (styles.position === 'absolute' || styles.position === 'fixed') return false
  return true
}

export function hasSlideOverflow(slide, tolerance = 2) {
  const slideRect = slide.getBoundingClientRect()
  return Array.from(slide.children).some((child) => {
    if (!isMeasurableSlideChild(child)) return false
    const rect = child.getBoundingClientRect()
    return rect.left < slideRect.left - tolerance
      || rect.top < slideRect.top - tolerance
      || rect.right > slideRect.right + tolerance
      || rect.bottom > slideRect.bottom + tolerance
  })
}

export async function resolveFitScale(slide, fit) {
  if (fit?.id !== 'auto') return fit?.scale || 1

  const html = document.documentElement
  for (const scale of AUTO_FIT_SCALES) {
    html.style.setProperty('--deckio-export-fit-scale', String(scale))
    await waitForPaint()
    if (!hasSlideOverflow(slide)) return scale
  }
  return AUTO_FIT_SCALES[AUTO_FIT_SCALES.length - 1]
}

export function pauseAnimations(slide) {
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

export async function captureSlidePng({
  domToPng,
  deck,
  slide,
  layout,
  quality,
  fit,
  backgroundColor,
}) {
  const restoreStage = prepareExportStage(deck, slide, layout)

  try {
    await waitForPaint()
    const fitScale = await resolveFitScale(slide, fit)
    document.documentElement.style.setProperty('--deckio-export-fit-scale', String(fitScale))
    await waitForPaint()
    await waitForAssets(slide)

    const restoreAnimations = pauseAnimations(slide)
    try {
      await waitForPaint()
      return await domToPng(slide, {
        width: layout.pixelWidth,
        height: layout.pixelHeight,
        backgroundColor,
        scale: quality.scale,
        style: {
          position: 'relative',
          inset: 'auto',
          left: '0',
          top: '0',
          width: `${layout.pixelWidth}px`,
          height: `${layout.pixelHeight}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          boxSizing: 'border-box',
          opacity: '1',
          visibility: 'visible',
          transform: 'none',
          transition: 'none',
        },
      })
    } finally {
      restoreAnimations()
    }
  } finally {
    restoreStage()
  }
}
