#!/usr/bin/env node
/**
 * Syncs public/opportunity-data.js from the central data module.
 * Run: node scripts/sync-dashboard.mjs
 * Runs automatically via "predev" and "prebuild" npm scripts.
 */
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  customers, DISCOUNT, PRICE_BUSINESS, TARGET_PENETRATION,
  dashboardData, dashboardKPIs,
} from '../src/data/opportunity.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const output = `// AUTO-GENERATED — do not edit manually.
// Source of truth: src/data/opportunity.js
// Re-generate:  node scripts/sync-dashboard.mjs  (or npm run sync-data)

window.DASHBOARD_DATA = ${JSON.stringify(dashboardData, null, 2)};
window.DASHBOARD_KPIS = ${JSON.stringify(dashboardKPIs, null, 2)};
window.PRICE_BUSINESS = ${PRICE_BUSINESS};
window.DISCOUNT = ${DISCOUNT};
window.TARGET_PENETRATION = ${TARGET_PENETRATION};
`

writeFileSync(resolve(__dirname, '../public/opportunity-data.js'), output)
console.log('✓ public/opportunity-data.js synced from src/data/opportunity.js')
