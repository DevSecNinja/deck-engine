import { describe, it, expect } from 'vitest'
import { slugify, packageJson, deckConfig, mainJsx, resolveEngineRef } from '../utils.mjs'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('My Cool Talk')).toBe('my-cool-talk')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('collapses non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('a!!!b###c')).toBe('a-b-c')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('preserves numbers', () => {
    expect(slugify('Q3 2025 Review')).toBe('q3-2025-review')
  })

  it('handles already-slugified input', () => {
    expect(slugify('already-slugged')).toBe('already-slugged')
  })

  it('handles special characters and unicode', () => {
    expect(slugify('café & résumé!')).toBe('caf-r-sum')
  })
})

describe('packageJson', () => {
  it('returns valid JSON', () => {
    const result = packageJson('test-deck')
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('sets project name with deck-project- prefix', () => {
    const pkg = JSON.parse(packageJson('quarterly-review'))
    expect(pkg.name).toBe('deck-project-quarterly-review')
  })

  it('marks package as private', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.private).toBe(true)
  })

  it('uses ESM module type', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.type).toBe('module')
  })

  it('includes vite dev/build/preview scripts', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.scripts.dev).toBe('vite')
    expect(pkg.scripts.build).toBe('vite build')
    expect(pkg.scripts.preview).toBe('vite preview')
  })

  it('depends on deck-engine, react, and react-dom', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.dependencies).toHaveProperty('@deckio/deck-engine')
    expect(pkg.dependencies).toHaveProperty('react')
    expect(pkg.dependencies).toHaveProperty('react-dom')
  })

  it('has vite and plugin-react as dev dependencies', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.devDependencies).toHaveProperty('vite')
    expect(pkg.devDependencies).toHaveProperty('@vitejs/plugin-react')
  })

  it('includes tailwindcss and @tailwindcss/vite as dev dependencies', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.devDependencies).toHaveProperty('tailwindcss')
    expect(pkg.devDependencies).toHaveProperty('@tailwindcss/vite')
  })

  it('ends with a trailing newline', () => {
    const result = packageJson('x')
    expect(result.endsWith('\n')).toBe(true)
  })
})

describe('deckConfig', () => {
  it('generates valid JS with the correct id', () => {
    const config = deckConfig('my-talk', 'My Talk', 'A subtitle', '🎤', '#ff0000')
    expect(config).toContain("id: 'my-talk'")
  })

  it('includes title and subtitle', () => {
    const config = deckConfig('s', 'Title Here', 'Sub Here', '📊', '#000')
    expect(config).toContain("title: 'Title Here'")
    expect(config).toContain("subtitle: 'Sub Here'")
  })

  it('uses subtitle as description', () => {
    const config = deckConfig('s', 'T', 'Desc Value', '🎯', '#fff')
    // description should equal subtitle
    const matches = config.match(/description: '([^']+)'/)?.[1]
    expect(matches).toBe('Desc Value')
  })

  it('includes icon and accent', () => {
    const config = deckConfig('s', 'T', 'S', '🚀', '#3fb950')
    expect(config).toContain("icon: '🚀'")
    expect(config).toContain("accent: '#3fb950'")
  })

  it('escapes single quotes in inputs', () => {
    const config = deckConfig("it's", "It's Great", "don't stop", '🎵', '#abc')
    expect(config).toContain("it\\'s")
    expect(config).toContain("It\\'s Great")
    expect(config).toContain("don\\'t stop")
  })

  it('imports CoverSlide and ThankYouSlide', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000')
    expect(config).toContain("import CoverSlide from './src/slides/CoverSlide.jsx'")
    expect(config).toContain("import { GenericThankYouSlide as ThankYouSlide } from '@deckio/deck-engine'")
  })

  it('registers both slides in the slides array', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000')
    expect(config).toContain('CoverSlide,')
    expect(config).toContain('ThankYouSlide,')
  })

  it('sets order to 1', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000')
    expect(config).toContain('order: 1')
  })

  it('defaults theme to dark when not specified', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000')
    expect(config).toContain("theme: 'dark'")
  })

  it('includes specified theme', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn')
    expect(config).toContain("theme: 'shadcn'")
  })

  it('supports light theme', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'light')
    expect(config).toContain("theme: 'light'")
  })

  it('includes theme field in output', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'dark')
    expect(config).toMatch(/theme:\s*'/)
  })
})

describe('mainJsx', () => {
  it('defaults to dark theme import when no theme specified', () => {
    const jsx = mainJsx()
    expect(jsx).toContain("@deckio/deck-engine/themes/dark.css")
  })

  it('imports the specified dark theme CSS', () => {
    const jsx = mainJsx('dark')
    expect(jsx).toContain("import '@deckio/deck-engine/themes/dark.css'")
  })

  it('imports the specified light theme CSS', () => {
    const jsx = mainJsx('light')
    expect(jsx).toContain("import '@deckio/deck-engine/themes/light.css'")
  })

  it('imports the specified shadcn theme CSS', () => {
    const jsx = mainJsx('shadcn')
    expect(jsx).toContain("import '@deckio/deck-engine/themes/shadcn.css'")
  })

  it('theme selection changes the CSS import path', () => {
    const dark = mainJsx('dark')
    const light = mainJsx('light')
    expect(dark).not.toBe(light)
    expect(dark).toContain('/dark.css')
    expect(light).toContain('/light.css')
  })

  it('always imports global.css', () => {
    const jsx = mainJsx('dark')
    expect(jsx).toContain("@deckio/deck-engine/styles/global.css")
  })

  it('renders App component inside StrictMode', () => {
    const jsx = mainJsx('dark')
    expect(jsx).toContain('<StrictMode>')
    expect(jsx).toContain('<App />')
  })

  it('imports react and react-dom/client', () => {
    const jsx = mainJsx('dark')
    expect(jsx).toContain("from 'react'")
    expect(jsx).toContain("from 'react-dom/client'")
  })
})

describe('resolveEngineRef', () => {
  it('returns a string', () => {
    expect(typeof resolveEngineRef()).toBe('string')
  })

  it('returns a semver range when called without projectDir', () => {
    const ref = resolveEngineRef()
    expect(ref).toMatch(/^\^/)
  })

  it('returns a file: protocol reference when given a projectDir', () => {
    const ref = resolveEngineRef('/tmp/test-project')
    expect(ref.startsWith('file:')).toBe(true)
  })

  it('file: reference points to the deck-engine package', () => {
    const ref = resolveEngineRef('/tmp/test-project')
    expect(ref).toContain('deck-engine')
  })

  it('version matches engine package.json', async () => {
    const ref = resolveEngineRef()
    // In the monorepo, this reads the engine's actual version
    const { readFileSync } = await import('fs')
    const { join, dirname } = await import('path')
    const { fileURLToPath } = await import('url')
    const utilsDir = dirname(fileURLToPath(import.meta.url))
    const enginePkg = JSON.parse(readFileSync(join(utilsDir, '..', '..', 'deck-engine', 'package.json'), 'utf-8'))
    expect(ref).toBe(`^${enginePkg.version}`)
  })

  it('packageJson uses resolveEngineRef by default', () => {
    const pkg = JSON.parse(packageJson('x'))
    const ref = resolveEngineRef()
    expect(pkg.dependencies['@deckio/deck-engine']).toBe(ref)
  })

  it('packageJson accepts an explicit engineRef override', () => {
    const pkg = JSON.parse(packageJson('x', 'file:../my-engine'))
    expect(pkg.dependencies['@deckio/deck-engine']).toBe('file:../my-engine')
  })
})
