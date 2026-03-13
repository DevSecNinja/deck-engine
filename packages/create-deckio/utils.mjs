/**
 * Pure utility functions for the deck project scaffolder.
 *
 * Extracted so they can be unit-tested independently of the
 * interactive CLI entry point.
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Resolve the @deckio/deck-engine dependency reference for generated projects.
 *
 * Local dev (monorepo):  file: protocol pointing to the engine package
 * npm-installed:         ^version from the engine's package.json
 */
export function resolveEngineRef(projectDir) {
  const enginePkgPath = join(__dirname, '..', 'deck-engine', 'package.json')

  try {
    if (existsSync(enginePkgPath)) {
      const enginePkg = JSON.parse(readFileSync(enginePkgPath, 'utf-8'))
      if (enginePkg.name === '@deckio/deck-engine') {
        // In local dev, use file: protocol so npm install never hits the registry
        if (projectDir) {
          const engineDir = join(__dirname, '..', 'deck-engine')
          return `file:${relative(projectDir, engineDir)}`
        }
        return `^${enginePkg.version}`
      }
    }
  } catch { /* fall through to fallback */ }

  // Fallback: latest known published version (npm-installed scaffolder)
  return '^1.8.2'
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function packageJson(name, engineRef) {
  if (!engineRef) engineRef = resolveEngineRef()
  return JSON.stringify({
    name: `deck-project-${name}`,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      '@deckio/deck-engine': engineRef,
      react: '^19.1.0',
      'react-dom': '^19.1.0',
    },
    devDependencies: {
      '@tailwindcss/vite': '^4.1.0',
      '@vitejs/plugin-react': '^4.4.1',
      tailwindcss: '^4.1.0',
      vite: '^6.3.5',
    },
  }, null, 2) + '\n'
}

export function mainJsx(theme = 'dark') {
  return `\
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@deckio/deck-engine/styles/global.css'
import '@deckio/deck-engine/themes/${theme}.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`
}

export function deckConfig(slug, title, subtitle, icon, accent, theme = 'dark') {
  const esc = (s) => s.replace(/'/g, "\\'")
  return `\
import CoverSlide from './src/slides/CoverSlide.jsx'
import { GenericThankYouSlide as ThankYouSlide } from '@deckio/deck-engine'

export default {
  id: '${esc(slug)}',
  title: '${esc(title)}',
  subtitle: '${esc(subtitle)}',
  description: '${esc(subtitle)}',
  icon: '${esc(icon)}',
  accent: '${esc(accent)}',
  theme: '${esc(theme)}',
  order: 1,
  slides: [
    CoverSlide,
    ThankYouSlide,
  ],
}
`
}
