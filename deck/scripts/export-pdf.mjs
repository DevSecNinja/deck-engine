#!/usr/bin/env node
/**
 * Export slides to PDF using Puppeteer.
 *
 * Usage:
 *   node scripts/export-pdf.mjs                    # exports all slides
 *   node scripts/export-pdf.mjs --from 1 --to 8    # internal slides only (1-indexed)
 *   node scripts/export-pdf.mjs --from 9 --to 17   # customer slides only
 *
 * The dev server must be running (npm run dev).
 */
import puppeteer from 'puppeteer'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '..', 'exports')

// ── Parse CLI args ──
const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? Number(args[idx + 1]) : fallback
}

function getStringArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const PORT = getArg('port', 5173)
const BASE = `http://localhost:${PORT}`
const FROM = getArg('from', null) // 1-indexed, inclusive
const TO = getArg('to', null)     // 1-indexed, inclusive
const CUSTOMER_NAME = getStringArg('customer-name', null)
const isCustomer = args.includes('--customer')
const outFile = isCustomer
  ? `${(CUSTOMER_NAME || 'customer').toLowerCase()}-slides.pdf`
  : args.includes('--internal') ? 'internal-slides.pdf' : 'slides.pdf'

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

async function exportPDF() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 })

  // Navigate to the app
  console.log(`⏳ Loading ${BASE} ...`)
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })
  await page.waitForSelector('.slide.active', { timeout: 10000 })

  // If exporting customer slides, select the customer via the UI
  if (isCustomer && CUSTOMER_NAME) {
    console.log(`👤 Selecting customer: ${CUSTOMER_NAME}`)
    // Click "Customer Facing" card — find by text content
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const custBtn = buttons.find(b => b.textContent.includes('Customer Facing'))
      if (custBtn) { custBtn.click(); return true }
      return false
    })
    if (!clicked) {
      console.error('❌ Could not find "Customer Facing" button')
      await browser.close()
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 800))

    // Click the matching customer logo button by text
    const picked = await page.evaluate((name) => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const match = buttons.find(b => b.textContent.trim().includes(name))
      if (match) { match.click(); return true }
      return false
    }, CUSTOMER_NAME)
    if (!picked) {
      console.error(`❌ Customer "${CUSTOMER_NAME}" not found in picker`)
      await browser.close()
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 1000))
    console.log(`✅ Customer selected`)
  }

  // Hide navigation arrows and any overlays for clean capture
  await page.evaluate(() => {
    const nav = document.querySelector('[class*="Navigation"]') || document.querySelector('nav')
    if (nav) nav.style.display = 'none'
    // Hide all elements with nav-related classes
    document.querySelectorAll('[class*="nav"]').forEach(el => {
      if (el.tagName !== 'BODY' && el.tagName !== 'HTML') {
        el.style.display = 'none'
      }
    })
  })

  // Get total slides from the DOM
  const totalSlides = await page.evaluate(() => {
    return document.querySelectorAll('.slide').length
  })
  console.log(`📊 Found ${totalSlides} slides`)

  const fromIdx = FROM ? FROM - 1 : 0
  const toIdx = TO ? TO - 1 : totalSlides - 1
  const count = toIdx - fromIdx + 1
  console.log(`📄 Exporting slides ${fromIdx + 1}–${toIdx + 1} (${count} pages)`)

  // Navigate to the starting slide
  await page.evaluate((idx) => {
    // Access the goTo from the slide context — we'll use keyboard nav instead
  }, fromIdx)

  // Go to slide 0 first via Home-like action
  for (let i = 0; i < totalSlides; i++) {
    await page.keyboard.press('ArrowLeft')
    await new Promise(r => setTimeout(r, 50))
  }

  // Navigate to fromIdx
  for (let i = 0; i < fromIdx; i++) {
    await page.keyboard.press('ArrowRight')
    await new Promise(r => setTimeout(r, 100))
  }
  // Wait for transition
  await new Promise(r => setTimeout(r, 800))

  // Capture each slide as a screenshot, then combine into PDF
  const screenshots = []
  for (let i = fromIdx; i <= toIdx; i++) {
    console.log(`  📸 Capturing slide ${i + 1}/${totalSlides}`)

    // Wait for the transition to settle
    await new Promise(r => setTimeout(r, 300))
    
    const screenshot = await page.screenshot({ type: 'png', encoding: 'binary' })
    screenshots.push(screenshot)

    if (i < toIdx) {
      await page.keyboard.press('ArrowRight')
      await new Promise(r => setTimeout(r, 700))
    }
  }

  // Create PDF from screenshots — use exact pixel dimensions to avoid margins
  const pdfPage = await browser.newPage()
  await pdfPage.setViewport({ width: 1920, height: 1080 })

  // Build an HTML page with all screenshots as full-page images
  const imgTags = screenshots.map((buf, i) => {
    const b64 = Buffer.from(buf).toString('base64')
    return `<div class="page"><img src="data:image/png;base64,${b64}" /></div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; overflow: hidden; }
  @page { size: 1920px 1080px; margin: 0; }
  .page { 
    width: 1920px; height: 1080px; 
    page-break-after: always;
    page-break-inside: avoid;
    overflow: hidden;
    position: relative;
  }
  .page:last-child { page-break-after: avoid; }
  .page img { 
    display: block; 
    width: 1920px; height: 1080px; 
    object-fit: fill; 
  }
</style>
</head>
<body>${imgTags}</body>
</html>`

  await pdfPage.setContent(html, { waitUntil: 'load' })

  const pdfPath = path.join(outDir, outFile)
  await pdfPage.pdf({
    path: pdfPath,
    width: '1920px',
    height: '1080px',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
  })

  await browser.close()
  console.log(`\n✅ PDF exported to: ${pdfPath}`)
}

exportPDF().catch(err => {
  console.error('❌ Export failed:', err.message)
  process.exit(1)
})
