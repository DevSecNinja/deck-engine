#!/usr/bin/env node
/**
 * capture-slide.mjs — Cross-platform slide screenshot capture.
 *
 * Strategies (tried in order):
 *   1. Direct Puppeteer (searched in project, launcher, and container paths)
 *   2. Launcher capture API (POST /api/capture/:id)
 *
 * Usage:
 *   node node_modules/@deckio/deck-engine/scripts/capture-slide.mjs --slide 3
 *   node node_modules/@deckio/deck-engine/scripts/capture-slide.mjs --slide 1 --port 5173 --project-id my-deck
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { request } from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { slide: 1, port: null, projectId: null, launcherPort: null, output: null }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slide' && args[i + 1]) opts.slide = parseInt(args[++i], 10)
    else if (args[i] === '--port' && args[i + 1]) opts.port = parseInt(args[++i], 10)
    else if (args[i] === '--project-id' && args[i + 1]) opts.projectId = args[++i]
    else if (args[i] === '--launcher-port' && args[i + 1]) opts.launcherPort = parseInt(args[++i], 10)
    else if (args[i] === '--output' && args[i + 1]) opts.output = args[++i]
  }
  return opts
}

function readStateMd() {
  const statePath = join(projectRoot, '.github', 'memory', 'state.md')
  if (!existsSync(statePath)) return {}
  const content = readFileSync(statePath, 'utf-8')
  const port = content.match(/^port:\s*(\d+)/m)
  const id = content.match(/^id:\s*(.+)/m)
  return { port: port ? parseInt(port[1], 10) : null, projectId: id ? id[1].trim() : null }
}

function readConfigId() {
  const configPath = join(projectRoot, 'deck.config.js')
  if (!existsSync(configPath)) return null
  const content = readFileSync(configPath, 'utf-8')
  const m = content.match(/id:\s*['"`]([^'"`]+)['"`]/)
  return m ? m[1] : null
}

async function tryPuppeteer(url, slideIndex, projectId, outputPath) {
  // Search for puppeteer in multiple locations
  const candidates = [
    join(projectRoot, 'node_modules', 'puppeteer'),
    join(__dirname, '..', '..', '..', 'puppeteer'),       // engine sibling in launcher node_modules
    '/app/node_modules/puppeteer',                          // container path
  ]

  let puppeteer = null
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        puppeteer = await import(candidate)
        break
      }
    } catch { /* try next */ }
  }
  if (!puppeteer) return false

  const launch = puppeteer.default?.launch || puppeteer.launch
  if (!launch) return false

  const browser = await launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 })

    // Pre-set the slide index in sessionStorage so the deck opens on the right slide
    if (typeof slideIndex === 'number' && slideIndex >= 0) {
      await page.evaluateOnNewDocument((pid, idx) => {
        try { sessionStorage.setItem(`slide:${pid}`, String(idx)) } catch {}
      }, projectId, slideIndex)
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    // Give the slide transition a moment to render
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)))

    const buffer = await page.screenshot({ type: 'png' })
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, buffer)
    return true
  } finally {
    await browser.close()
  }
}

function callCaptureApi(launcherPort, projectId, slideIndex) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ slideIndex })
    const req = request({
      hostname: '127.0.0.1',
      port: launcherPort,
      path: `/api/capture/${encodeURIComponent(projectId)}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 20000,
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.ok) resolve(parsed)
          else reject(new Error(parsed.error || 'Capture API returned error'))
        } catch { reject(new Error('Invalid capture API response')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Capture API timeout')) })
    req.write(body)
    req.end()
  })
}

async function main() {
  const opts = parseArgs()
  const state = readStateMd()

  const projectId = opts.projectId || state.projectId || readConfigId() || 'unknown'
  const devPort = opts.port || state.port || 5173
  const launcherPort = opts.launcherPort || parseInt(process.env.DECK_LAUNCHER_PORT || process.env.PORT || '46000', 10)
  const slideIndex = (opts.slide || 1) - 1  // 1-based → 0-based

  const timestamp = Date.now()
  const outputPath = opts.output || join(projectRoot, '.github', 'eyes', `capture-${timestamp}.png`)
  const relativePath = outputPath.replace(projectRoot, '').replace(/\\/g, '/').replace(/^\//, '')

  const devUrl = `http://127.0.0.1:${devPort}`

  // Strategy 1: Direct Puppeteer
  try {
    if (await tryPuppeteer(devUrl, slideIndex, projectId, outputPath)) {
      console.log(JSON.stringify({ ok: true, strategy: 'puppeteer', path: relativePath }))
      return
    }
  } catch (err) {
    console.error(`Puppeteer capture failed: ${err.message}`)
  }

  // Strategy 2: Launcher capture API
  try {
    const result = await callCaptureApi(launcherPort, projectId, slideIndex)
    console.log(JSON.stringify({ ok: true, strategy: 'launcher-api', path: result.capture?.relativePath || relativePath }))
    return
  } catch (err) {
    console.error(`Launcher capture API failed: ${err.message}`)
  }

  console.error(JSON.stringify({ ok: false, error: 'All capture strategies failed. Ensure Puppeteer is available or the launcher is running.' }))
  process.exit(1)
}

main()
