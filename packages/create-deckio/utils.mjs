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

export function packageJson(name, engineRef, { designSystem = 'none' } = {}) {
  if (!engineRef) engineRef = resolveEngineRef()
  const deps = {
    '@deckio/deck-engine': engineRef,
    react: '^19.1.0',
    'react-dom': '^19.1.0',
  }
  if (designSystem === 'shadcn') {
    deps['class-variance-authority'] = '^0.7.1'
    deps['clsx'] = '^2.1.1'
    deps['tailwind-merge'] = '^3.3.0'
  }
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
    dependencies: deps,
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

export function deckConfig(slug, title, subtitle, icon, accent, theme = 'dark', designSystem = 'none') {
  const esc = (s) => s.replace(/'/g, "\\'")
  const dsLine = designSystem !== 'none' ? `\n  designSystem: '${esc(designSystem)}',` : ''
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
  theme: '${esc(theme)}',${dsLine}
  order: 1,
  slides: [
    CoverSlide,
    ThankYouSlide,
  ],
}
`
}

export function viteConfig({ designSystem = 'none' } = {}) {
  const aliasImport = designSystem === 'shadcn' ? "import path from 'path'\nimport { fileURLToPath } from 'url'\n\nconst __dirname = path.dirname(fileURLToPath(import.meta.url))\n\n" : ''
  const aliasBlock = designSystem === 'shadcn' ? `\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, 'src'),\n    },\n  },` : ''
  return `\
${aliasImport}import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { deckPlugin, tailwindPlugin } from '@deckio/deck-engine/vite'

export default defineConfig({
  plugins: [
    react({
      include: [/\\.[jt]sx?$/, /node_modules\\/@deckio\\/deck-engine\\/.+\\.jsx$/],
    }),
    deckPlugin(),
    tailwindPlugin(),
  ],${aliasBlock}
})
`
}

export function componentsJson() {
  return JSON.stringify({
    $schema: 'https://ui.shadcn.com/schema.json',
    style: 'new-york',
    rsc: false,
    tsx: false,
    tailwind: {
      config: '',
      css: 'src/index.css',
      baseColor: 'neutral',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
    },
    registries: {
      '@react-bits': 'https://reactbits.dev/r/{name}.json',
    },
  }, null, 2) + '\n'
}

export function cnUtility() {
  return `\
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
`
}

export const COLOR_PRESETS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#f97316', label: 'Orange' },
  { value: '#3b82f6', label: 'Blue' },
]

export function jsConfig() {
  return JSON.stringify({
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
      },
    },
  }, null, 2) + '\n'
}
