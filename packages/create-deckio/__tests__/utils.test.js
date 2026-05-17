import { describe, it, expect } from 'vitest'
import { slugify, packageJson, deckConfig, indexCss, mainJsx, resolveEngineRef, resolveEngineVersionLabel, viteConfig, componentsJson, cnUtility, jsConfig, COLOR_PRESETS, AURORA_PALETTES, AURORA_ACCENT_MAP, auroraAccent, themeProviderJsx, appJsx, coverSlideJsxShadcn, COVER_SLIDE_CSS_SHADCN, coverSlideJsxFabric, COVER_SLIDE_CSS_FABRIC, fabricIconsSlideJsx, FABRIC_ICONS_SLIDE_CSS, featuresSlideJsxShadcn, FEATURES_SLIDE_CSS_SHADCN, gettingStartedSlideJsxShadcn, GETTING_STARTED_SLIDE_CSS_SHADCN, thankYouSlideJsxShadcn, THANK_YOU_SLIDE_CSS_SHADCN, thankYouSlideJsxFabric, THANK_YOU_SLIDE_CSS_FABRIC, vscodeMcpConfig } from '../utils.mjs'

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

  it('imports CoverSlide and GenericThankYouSlide for default scaffold', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000')
    expect(config).toContain("import CoverSlide from './src/slides/CoverSlide.jsx'")
    expect(config).toContain("import { GenericThankYouSlide as ThankYouSlide } from '@deckio/deck-engine'")
    // Regression guard: default deck must not pull in HighlightsSlide
    // (shadcn-looking second slide removed in create-deckio 0.5.2).
    expect(config).not.toContain('HighlightsSlide')
  })

  it('registers cover and thank-you slides in order for default scaffold', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000')
    expect(config).toContain('CoverSlide,')
    expect(config).toContain('ThankYouSlide,')
    expect(config).not.toContain('HighlightsSlide,')
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

  it('defaults appearance to dark when not specified', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000')
    expect(config).toContain("appearance: 'dark'")
  })

  it('includes appearance field set to light', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'light', 'none', null, 'light')
    expect(config).toContain("appearance: 'light'")
  })

  it('includes appearance field for shadcn dark', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn', null, 'dark')
    expect(config).toContain("appearance: 'dark'")
  })

  it('includes appearance field for shadcn light', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn', null, 'light')
    expect(config).toContain("appearance: 'light'")
  })

  it('uses local cover, fabric icons, and thank-you slides for fabric scaffold', () => {
    const config = deckConfig('s', 'T', 'S', 'F', '#49C5B1', 'fabric', 'none', null, 'light')
    expect(config).toContain("import CoverSlide from './src/slides/CoverSlide.jsx'")
    expect(config).toContain("import FabricIconsSlide from './src/slides/FabricIconsSlide.jsx'")
    expect(config).toContain("import ThankYouSlide from './src/slides/ThankYouSlide.jsx'")
    expect(config).not.toContain('GenericThankYouSlide')
    expect(config).toContain("theme: 'fabric'")
    expect(config).toContain("appearance: 'light'")
    // FabricIconsSlide must sit between Cover and ThankYou.
    const coverIdx = config.indexOf('CoverSlide,')
    const iconsIdx = config.indexOf('FabricIconsSlide,')
    const thankIdx = config.indexOf('ThankYouSlide,')
    expect(coverIdx).toBeGreaterThan(-1)
    expect(iconsIdx).toBeGreaterThan(coverIdx)
    expect(thankIdx).toBeGreaterThan(iconsIdx)
  })
})

describe('indexCss', () => {
  it('imports the engine global stylesheet', () => {
    expect(indexCss('dark')).toContain("@deckio/deck-engine/styles/global.css")
  })

  it('imports the selected theme stylesheet', () => {
    expect(indexCss('shadcn')).toContain("@deckio/deck-engine/themes/shadcn.css")
  })
})

describe('mainJsx', () => {
  it('imports the local CSS entrypoint', () => {
    const jsx = mainJsx()
    expect(jsx).toContain("import './index.css'")
  })

  it('does not inline engine stylesheet imports anymore', () => {
    const jsx = mainJsx('dark')
    expect(jsx).not.toContain('@deckio/deck-engine/styles/global.css')
    expect(jsx).not.toContain('@deckio/deck-engine/themes/dark.css')
  })

  it('theme selection does not change main JSX output', () => {
    expect(mainJsx('dark')).toBe(mainJsx('light'))
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

  it('display label shows the local engine version', async () => {
    const label = resolveEngineVersionLabel()
    const { readFileSync } = await import('fs')
    const { join, dirname } = await import('path')
    const { fileURLToPath } = await import('url')
    const utilsDir = dirname(fileURLToPath(import.meta.url))
    const enginePkg = JSON.parse(readFileSync(join(utilsDir, '..', '..', 'deck-engine', 'package.json'), 'utf-8'))
    expect(label).toBe(`v${enginePkg.version} (local workspace)`)
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

describe('viteConfig', () => {
  it('generates valid JS with defineConfig', () => {
    const config = viteConfig()
    expect(config).toContain("import { defineConfig } from 'vite'")
    expect(config).toContain('export default defineConfig')
  })

  it('includes react, deckPlugin, and tailwindPlugin by default', () => {
    const config = viteConfig()
    expect(config).toContain('react(')
    expect(config).toContain('deckPlugin({ inlineEditing: true })')
    expect(config).toContain('tailwindPlugin()')
  })

  it('does NOT include path alias when designSystem is none', () => {
    const config = viteConfig({ designSystem: 'none' })
    expect(config).not.toContain('resolve:')
    expect(config).not.toContain("alias:")
    expect(config).not.toContain("import path from 'path'")
  })

  it('includes @ alias when designSystem is shadcn', () => {
    const config = viteConfig({ designSystem: 'shadcn' })
    expect(config).toContain("resolve:")
    expect(config).toContain("'@': path.resolve(__dirname, 'src')")
  })

  it('imports path and url modules when designSystem is shadcn', () => {
    const config = viteConfig({ designSystem: 'shadcn' })
    expect(config).toContain("import path from 'path'")
    expect(config).toContain("import { fileURLToPath } from 'url'")
    expect(config).toContain('const __dirname')
  })

  it('defaults to no designSystem', () => {
    const config = viteConfig()
    expect(config).not.toContain('resolve:')
  })

  it('includes server.fs.allow for file: protocol compatibility', () => {
    const config = viteConfig()
    expect(config).toContain('server:')
    expect(config).toContain('fs:')
    expect(config).toContain("allow: ['..', '../..']")
  })

  it('includes server.fs.allow in shadcn mode too', () => {
    const config = viteConfig({ designSystem: 'shadcn' })
    expect(config).toContain("allow: ['..', '../..']")
  })

  describe('fabric theme vite config (no optimizeDeps)', () => {
    it('does not include optimizeDeps for fabric theme (icons use @vite-ignore)', () => {
      const config = viteConfig({ theme: 'fabric' })
      expect(config).not.toContain('optimizeDeps:')
      expect(config).not.toContain('@fabric-msft/svg-icons')
    })

    it('omits optimizeDeps for non-fabric themes', () => {
      const dark = viteConfig({ theme: 'dark' })
      const shadcn = viteConfig({ designSystem: 'shadcn', theme: 'dark' })
      expect(dark).not.toContain('optimizeDeps:')
      expect(dark).not.toContain('@fabric-msft/svg-icons')
      expect(shadcn).not.toContain('optimizeDeps:')
      expect(shadcn).not.toContain('@fabric-msft/svg-icons')
    })

    it('combines fabric theme with shadcn alias when both are set', () => {
      const config = viteConfig({ designSystem: 'shadcn', theme: 'fabric' })
      expect(config).not.toContain('optimizeDeps:')
      expect(config).toContain("'@': path.resolve(__dirname, 'src')")
    })
  })
})

describe('componentsJson', () => {
  it('returns valid JSON', () => {
    const result = componentsJson()
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('includes shadcn schema URL', () => {
    const json = JSON.parse(componentsJson())
    expect(json.$schema).toBe('https://ui.shadcn.com/schema.json')
  })

  it('uses new-york style', () => {
    const json = JSON.parse(componentsJson())
    expect(json.style).toBe('new-york')
  })

  it('sets rsc to false (no server components)', () => {
    const json = JSON.parse(componentsJson())
    expect(json.rsc).toBe(false)
  })

  it('sets tsx to false (JSX project)', () => {
    const json = JSON.parse(componentsJson())
    expect(json.tsx).toBe(false)
  })

  it('configures tailwind with cssVariables enabled', () => {
    const json = JSON.parse(componentsJson())
    expect(json.tailwind.cssVariables).toBe(true)
    expect(json.tailwind.baseColor).toBe('neutral')
  })

  it('configures aliases with @ prefix', () => {
    const json = JSON.parse(componentsJson())
    expect(json.aliases.components).toBe('@/components')
    expect(json.aliases.utils).toBe('@/lib/utils')
    expect(json.aliases.ui).toBe('@/components/ui')
  })

  it('ends with trailing newline', () => {
    expect(componentsJson().endsWith('\n')).toBe(true)
  })

  it('includes ReactBits registry', () => {
    const json = JSON.parse(componentsJson())
    expect(json.registries).toBeDefined()
    expect(json.registries['@react-bits']).toBe('https://reactbits.dev/r/{name}.json')
  })
})

describe('cnUtility', () => {
  it('imports clsx and tailwind-merge', () => {
    const code = cnUtility()
    expect(code).toContain('import { clsx } from "clsx"')
    expect(code).toContain('import { twMerge } from "tailwind-merge"')
  })

  it('exports cn function', () => {
    const code = cnUtility()
    expect(code).toContain('export function cn(')
  })

  it('combines clsx and twMerge', () => {
    const code = cnUtility()
    expect(code).toContain('twMerge(clsx(inputs))')
  })
})

describe('packageJson with designSystem', () => {
  it('includes shadcn deps when designSystem is shadcn', () => {
    const pkg = JSON.parse(packageJson('x', undefined, { designSystem: 'shadcn' }))
    expect(pkg.dependencies).toHaveProperty('class-variance-authority')
    expect(pkg.dependencies).toHaveProperty('clsx')
    expect(pkg.dependencies).toHaveProperty('tailwind-merge')
  })

  it('does NOT include shadcn deps when designSystem is none', () => {
    const pkg = JSON.parse(packageJson('x', undefined, { designSystem: 'none' }))
    expect(pkg.dependencies).not.toHaveProperty('class-variance-authority')
    expect(pkg.dependencies).not.toHaveProperty('clsx')
    expect(pkg.dependencies).not.toHaveProperty('tailwind-merge')
  })

  it('does NOT include shadcn deps by default', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.dependencies).not.toHaveProperty('class-variance-authority')
  })

  it('still includes core deps when designSystem is shadcn', () => {
    const pkg = JSON.parse(packageJson('x', undefined, { designSystem: 'shadcn' }))
    expect(pkg.dependencies).toHaveProperty('react')
    expect(pkg.dependencies).toHaveProperty('react-dom')
    expect(pkg.dependencies).toHaveProperty('@deckio/deck-engine')
  })

  it('packageJson adds @fabric-msft/svg-icons for fabric theme', () => {
    const pkg = JSON.parse(packageJson('x', undefined, { theme: 'fabric' }))
    expect(pkg.dependencies['@fabric-msft/svg-icons']).toBe('^7.0.1')
  })

  it('packageJson does not add @fabric-msft/svg-icons for non-fabric themes', () => {
    const pkg = JSON.parse(packageJson('x', undefined, { theme: 'dark' }))
    expect(pkg.dependencies).not.toHaveProperty('@fabric-msft/svg-icons')
  })
})

describe('deckConfig with designSystem', () => {
  it('includes designSystem field when shadcn', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn')
    expect(config).toContain("designSystem: 'shadcn'")
  })

  it('omits designSystem field when none', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'dark', 'none')
    expect(config).not.toContain('designSystem')
  })

  it('omits designSystem field by default', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'dark')
    expect(config).not.toContain('designSystem')
  })

  it('can have theme shadcn without designSystem', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'none')
    expect(config).toContain("theme: 'shadcn'")
    expect(config).not.toContain('designSystem')
  })
})

describe('jsConfig', () => {
  it('returns valid JSON', () => {
    expect(() => JSON.parse(jsConfig())).not.toThrow()
  })

  it('sets baseUrl to current directory', () => {
    const json = JSON.parse(jsConfig())
    expect(json.compilerOptions.baseUrl).toBe('.')
  })

  it('maps @/* to ./src/*', () => {
    const json = JSON.parse(jsConfig())
    expect(json.compilerOptions.paths['@/*']).toEqual(['./src/*'])
  })

  it('ends with trailing newline', () => {
    expect(jsConfig().endsWith('\n')).toBe(true)
  })
})

describe('COLOR_PRESETS', () => {
  it('is an array of at least 8 presets', () => {
    expect(Array.isArray(COLOR_PRESETS)).toBe(true)
    expect(COLOR_PRESETS.length).toBeGreaterThanOrEqual(8)
  })

  it('each preset has a value (hex) and label (string)', () => {
    for (const preset of COLOR_PRESETS) {
      expect(preset.value).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(typeof preset.label).toBe('string')
      expect(preset.label.length).toBeGreaterThan(0)
    }
  })

  it('includes Indigo as the first preset', () => {
    expect(COLOR_PRESETS[0].label).toBe('Indigo')
    expect(COLOR_PRESETS[0].value).toBe('#6366f1')
  })

  it('has no duplicate values', () => {
    const values = COLOR_PRESETS.map((p) => p.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('has no duplicate labels', () => {
    const labels = COLOR_PRESETS.map((p) => p.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('themeProviderJsx', () => {
  it('exports ThemeProvider component', () => {
    const code = themeProviderJsx()
    expect(code).toContain('export function ThemeProvider(')
  })

  it('exports useTheme hook', () => {
    const code = themeProviderJsx()
    expect(code).toContain('export function useTheme(')
  })

  it('uses localStorage for persistence', () => {
    const code = themeProviderJsx()
    expect(code).toContain('localStorage.getItem')
    expect(code).toContain('localStorage.setItem')
  })

  it('manages light, dark, and system themes', () => {
    const code = themeProviderJsx()
    expect(code).toContain("root.classList.remove('light', 'dark')")
    expect(code).toContain("'system'")
    expect(code).toContain('prefers-color-scheme: dark')
  })

  it('defaults to light theme', () => {
    const code = themeProviderJsx()
    expect(code).toContain("defaultTheme = 'light'")
  })

  it('uses deckio storage key', () => {
    const code = themeProviderJsx()
    expect(code).toContain("storageKey = 'deckio-ui-theme'")
  })
})

describe('appJsx', () => {
  it('returns App component without ThemeProvider by default', () => {
    const code = appJsx()
    expect(code).toContain('export default function App(')
    expect(code).not.toContain('ThemeProvider')
    expect(code).not.toContain('ModeToggle')
  })

  it('wraps default (non-shadcn) deck with InlineEditProvider', () => {
    const code = appJsx()
    expect(code).toContain('InlineEditProvider')
    expect(code).toContain('<InlineEditProvider')
    expect(code).toContain('overrides={overrides}')
    // Production exclusion: built decks must not load the override JSON.
    expect(code).toContain('import.meta.env.DEV ? inlineEdits : {}')
  })

  it('wraps shadcn deck with InlineEditProvider', () => {
    const code = appJsx({ designSystem: 'shadcn' })
    expect(code).toContain('InlineEditProvider')
    expect(code).toContain('<InlineEditProvider')
    expect(code).toContain('overrides={overrides}')
    expect(code).toContain('import.meta.env.DEV ? inlineEdits : {}')
    expect(code).toContain("import inlineEdits from './data/inline-edits.json'")
    expect(code).toContain("import '@deckio/deck-engine/styles/editable.css'")
  })

  it('wraps with ThemeProvider when designSystem is shadcn (defaults to dark)', () => {
    const code = appJsx({ designSystem: 'shadcn' })
    expect(code).toContain('<ThemeProvider defaultTheme="dark">')
    expect(code).toContain('</ThemeProvider>')
  })

  it('sets ThemeProvider defaultTheme to dark when appearance is dark', () => {
    const code = appJsx({ designSystem: 'shadcn', appearance: 'dark' })
    expect(code).toContain('<ThemeProvider defaultTheme="dark">')
  })

  it('sets ThemeProvider defaultTheme to light when appearance is light', () => {
    const code = appJsx({ designSystem: 'shadcn', appearance: 'light' })
    expect(code).toContain('<ThemeProvider defaultTheme="light">')
  })

  it('does not include ModeToggle (appearance is set at scaffold time)', () => {
    const code = appJsx({ designSystem: 'shadcn' })
    expect(code).not.toContain('ModeToggle')
    expect(code).not.toContain('mode-toggle')
  })

  it('imports ThemeProvider when designSystem is shadcn', () => {
    const code = appJsx({ designSystem: 'shadcn' })
    expect(code).toContain("import { ThemeProvider } from './components/theme-provider'")
  })

  it('always includes Navigation and SlideProvider', () => {
    for (const ds of ['none', 'shadcn']) {
      const code = appJsx({ designSystem: ds })
      expect(code).toContain('<Navigation />')
      expect(code).toContain('<SlideProvider')
    }
  })

  it('sets --accent CSS variable in both modes', () => {
    for (const ds of ['none', 'shadcn']) {
      const code = appJsx({ designSystem: ds })
      expect(code).toContain("setProperty('--accent', accent)")
    }
  })

  it('defaults designSystem to none', () => {
    const withDefault = appJsx()
    const withNone = appJsx({ designSystem: 'none' })
    expect(withDefault).toBe(withNone)
  })

  it('appearance has no effect when designSystem is none', () => {
    const dark = appJsx({ designSystem: 'none', appearance: 'dark' })
    const light = appJsx({ designSystem: 'none', appearance: 'light' })
    expect(dark).toBe(light)
    expect(dark).not.toContain('ThemeProvider')
  })

  it('renders Aurora as global background when designSystem is shadcn', () => {
    const code = appJsx({ designSystem: 'shadcn' })
    expect(code).toContain("import Aurora from '@/components/ui/aurora'")
    expect(code).toContain('<Aurora')
    expect(code).toContain('colorStops={auroraColors}')
    expect(code).toContain("project.aurora?.colors")
  })

  it('renders Aurora in a fixed-position wrapper for persistence across slides', () => {
    const code = appJsx({ designSystem: 'shadcn' })
    expect(code).toContain("position: 'fixed'")
    expect(code).toContain("pointerEvents: 'none'")
    expect(code).toContain("zIndex: 0")
  })

  it('does not render Aurora when designSystem is none', () => {
    const code = appJsx({ designSystem: 'none' })
    expect(code).not.toContain('Aurora')
    expect(code).not.toContain('aurora')
  })
})

describe('deckConfig shadcn slides', () => {
  it('imports all 4 slides when designSystem is shadcn', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn')
    expect(config).toContain("import CoverSlide from './src/slides/CoverSlide.jsx'")
    expect(config).toContain("import FeaturesSlide from './src/slides/FeaturesSlide.jsx'")
    expect(config).toContain("import GettingStartedSlide from './src/slides/GettingStartedSlide.jsx'")
    expect(config).toContain("import ThankYouSlide from './src/slides/ThankYouSlide.jsx'")
  })

  it('registers all 4 slides in order when shadcn', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn')
    const slidesSection = config.slice(config.indexOf('slides: ['))
    expect(slidesSection).toContain('CoverSlide,')
    expect(slidesSection).toContain('FeaturesSlide,')
    expect(slidesSection).toContain('GettingStartedSlide,')
    expect(slidesSection).toContain('ThankYouSlide,')
  })

  it('does NOT include showcase slides when designSystem is none', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'dark', 'none')
    expect(config).not.toContain('FeaturesSlide')
    expect(config).not.toContain('GettingStartedSlide')
  })
})

describe('coverSlideJsxShadcn', () => {
  it('does not import Aurora (moved to App.jsx)', () => {
    const jsx = coverSlideJsxShadcn('Title', 'Sub', 'slug')
    expect(jsx).not.toContain("import Aurora")
    expect(jsx).not.toContain('<Aurora')
  })

  it('does not import deck.config.js (aurora config now in App)', () => {
    const jsx = coverSlideJsxShadcn('Title', 'Sub', 'slug')
    expect(jsx).not.toContain("import project from")
  })

  it('has asymmetric two-column layout', () => {
    const jsx = coverSlideJsxShadcn('Title', 'Sub', 'slug')
    expect(jsx).toContain('layout')
    expect(jsx).toContain('main')
    expect(jsx).toContain('aside')
  })

  it('has overline with Badge component', () => {
    const jsx = coverSlideJsxShadcn('Title', 'Sub', 'slug')
    expect(jsx).toContain('Badge')
    expect(jsx).toContain('overline')
  })

  it('no longer uses BlurText for title/subtitle (uses Editable for inline editing)', () => {
    const jsx = coverSlideJsxShadcn('Title', 'Sub', 'slug')
    expect(jsx).not.toContain('BlurText')
    expect(jsx).toContain('Editable')
  })
})

describe('COVER_SLIDE_CSS_SHADCN', () => {
  it('does not set position relative on cover (no per-slide Aurora)', () => {
    // position: relative was removed to avoid cascade bug (see history)
    const coverBlock = COVER_SLIDE_CSS_SHADCN.split('.layout')[0]
    expect(coverBlock).not.toContain('position: relative')
  })

  it('does not have auroraWrapper (Aurora moved to App)', () => {
    expect(COVER_SLIDE_CSS_SHADCN).not.toContain('.auroraWrapper')
  })

  it('uses semi-transparent background for Aurora bleed-through', () => {
    expect(COVER_SLIDE_CSS_SHADCN).toContain('color-mix')
    expect(COVER_SLIDE_CSS_SHADCN).toContain('transparent')
  })

  it('uses Badge for overline styling', () => {
    expect(COVER_SLIDE_CSS_SHADCN).toContain('.overlineBadge')
  })

  it('has two-column grid layout', () => {
    expect(COVER_SLIDE_CSS_SHADCN).toContain('grid-template-columns')
  })

  it('has card enter animation', () => {
    expect(COVER_SLIDE_CSS_SHADCN).toContain('@keyframes card-enter')
  })
})

describe('featuresSlideJsxShadcn', () => {
  it('exports a function that returns JSX string', () => {
    const jsx = featuresSlideJsxShadcn('test-slug')
    expect(jsx).toContain('export default function FeaturesSlide()')
  })

  it('includes four capability cards', () => {
    const jsx = featuresSlideJsxShadcn('test-slug')
    expect(jsx).toContain('shadcn Ready')
    expect(jsx).toContain('ReactBits Animations')
    expect(jsx).toContain('Theme System')
    expect(jsx).toContain('Export Anywhere')
  })

  it('imports SpotlightCard from ReactBits', () => {
    const jsx = featuresSlideJsxShadcn('test-slug')
    expect(jsx).toContain("import SpotlightCard from '@/components/ui/spotlight-card'")
  })

  it('imports Slide, BottomBar, Editable, and EditableList from deck-engine', () => {
    const jsx = featuresSlideJsxShadcn('test-slug')
    expect(jsx).toContain("import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'")
  })

  it('wraps the feature grid in <EditableList> so items can be reordered live', () => {
    const jsx = featuresSlideJsxShadcn('test-slug')
    expect(jsx).toContain('<EditableList')
    expect(jsx).toContain('id="features.items"')
    expect(jsx).toContain('keyOf={(f) => f.id}')
  })

  it('uses slide index 1', () => {
    const jsx = featuresSlideJsxShadcn('test-slug')
    expect(jsx).toContain('<Slide index={1}')
  })
})

describe('FEATURES_SLIDE_CSS_SHADCN', () => {
  it('has two-column card grid layout', () => {
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('grid-template-columns: repeat(2, 1fr)')
  })

  it('has staggered card-in animation', () => {
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('@keyframes card-in')
  })

  it('uses semantic tokens for card styling', () => {
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('var(--card)')
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('var(--border)')
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('var(--accent)')
  })

  it('has SpotlightCard styling overrides', () => {
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('.spotCard')
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('var(--card)')
    expect(FEATURES_SLIDE_CSS_SHADCN).toContain('var(--border)')
  })
})

describe('gettingStartedSlideJsxShadcn', () => {
  it('exports a function that returns JSX string', () => {
    const jsx = gettingStartedSlideJsxShadcn('test-slug')
    expect(jsx).toContain('export default function GettingStartedSlide()')
  })

  it('includes three workflow steps', () => {
    const jsx = gettingStartedSlideJsxShadcn('test-slug')
    expect(jsx).toContain('Inspect')
    expect(jsx).toContain('Expand')
    expect(jsx).toContain('Compose')
  })

  it('shows the scaffold contract before adding primitives', () => {
    const jsx = gettingStartedSlideJsxShadcn('test-slug')
    expect(jsx).toContain('cat components.json && ls src/components/ui')
  })

  it('includes code block with npx shadcn command', () => {
    const jsx = gettingStartedSlideJsxShadcn('test-slug')
    expect(jsx).toContain('npx shadcn@latest add dialog sheet tabs')
  })

  it('includes Alert with pro tip', () => {
    const jsx = gettingStartedSlideJsxShadcn('test-slug')
    expect(jsx).toContain('Alert')
    expect(jsx).toContain('Pro tip')
  })

  it('uses slide index 2', () => {
    const jsx = gettingStartedSlideJsxShadcn('test-slug')
    expect(jsx).toContain('<Slide index={2}')
  })
})

describe('GETTING_STARTED_SLIDE_CSS_SHADCN', () => {
  it('has step-in animation', () => {
    expect(GETTING_STARTED_SLIDE_CSS_SHADCN).toContain('@keyframes step-in')
  })

  it('styles code blocks with semantic tokens', () => {
    expect(GETTING_STARTED_SLIDE_CSS_SHADCN).toContain('.codeBlock')
    expect(GETTING_STARTED_SLIDE_CSS_SHADCN).toContain('var(--secondary)')
    expect(GETTING_STARTED_SLIDE_CSS_SHADCN).toContain('var(--border)')
  })

  it('uses Badge for step numbers', () => {
    expect(GETTING_STARTED_SLIDE_CSS_SHADCN).toContain('.stepBadge')
  })

  it('has horizontal timeline layout', () => {
    expect(GETTING_STARTED_SLIDE_CSS_SHADCN).toContain('.timeline')
    expect(GETTING_STARTED_SLIDE_CSS_SHADCN).toContain('grid-template-columns: repeat(3, 1fr)')
  })
})

describe('thankYouSlideJsxShadcn', () => {
  it('defaults to slide index 3', () => {
    const jsx = thankYouSlideJsxShadcn('test-slug')
    expect(jsx).toContain('<Slide index={3}')
  })

  it('accepts custom slide index', () => {
    const jsx = thankYouSlideJsxShadcn('test-slug', 5)
    expect(jsx).toContain('<Slide index={5}')
  })
})

describe('fabric slide templates', () => {
  it('uses Fabric icons and Microsoft mark on the cover', () => {
    const jsx = coverSlideJsxFabric('Title', 'Sub', 'slug')
    expect(jsx).toContain('MicrosoftFabricIcon')
    expect(jsx).toContain('OneLakeIcon')
    expect(jsx).toContain('PowerBIIcon')
    expect(jsx).toContain('microsoftMark')
    expect(jsx).toContain('Microsoft Fabric | unified analytics platform')
    expect(COVER_SLIDE_CSS_FABRIC).toContain('#F25022')
  })

  it('uses Fabric icons and Fabric footer on the thank-you slide', () => {
    const jsx = thankYouSlideJsxFabric('slug', 2)
    expect(jsx).toContain('<Slide index={2}')
    expect(jsx).toContain('MicrosoftFabricIcon')
    expect(jsx).toContain('CopilotInFabricIcon')
    expect(jsx).toContain('Microsoft Fabric | OneLake, Power BI, and Copilot in Fabric')
    expect(THANK_YOU_SLIDE_CSS_FABRIC).toContain('.brandLockup')
  })

  it('renders a Fabric icons / workloads slide with the official icon set', () => {
    const jsx = fabricIconsSlideJsx('slug', 1)
    // Slide index defaults into the second position.
    expect(jsx).toContain('<Slide index={1}')
    // Imports come from the local fabric-icons helper (preserves dynamic imports + viewBox fix).
    expect(jsx).toContain("from '../data/fabric-icons.js'")
    // Every workload from FABRIC_WORKLOAD_ICONS we showcase must be wired up.
    for (const icon of [
      'MicrosoftFabricIcon',
      'OneLakeIcon',
      'PowerBIIcon',
      'DataFactoryIcon',
      'DataEngineeringIcon',
      'DataWarehouseIcon',
      'DataScienceIcon',
      'DatabasesIcon',
      'RealTimeIntelligenceIcon',
      'FabricIQIcon',
      'CopilotInFabricIcon',
    ]) {
      expect(jsx).toContain(icon)
    }
    // Editable contract preserved so users can rewrite copy inline.
    expect(jsx).toContain('id="fabricIcons.title"')
    expect(jsx).toContain('id="fabricIcons.subtitle"')
    expect(jsx).toContain('id="fabricIcons.footer"')
    // Microsoft chrome / branded background.
    expect(jsx).toContain('microsoftMark')
    expect(FABRIC_ICONS_SLIDE_CSS).toContain('#F25022')
    expect(FABRIC_ICONS_SLIDE_CSS).toContain('.tile')
    expect(FABRIC_ICONS_SLIDE_CSS).toContain('grid-template-columns')
  })

  it('fabricIconsSlideJsx defaults the slide index to 1 and accepts overrides', () => {
    expect(fabricIconsSlideJsx('slug')).toContain('<Slide index={1}')
    expect(fabricIconsSlideJsx('slug', 4)).toContain('<Slide index={4}')
  })
})

describe('shadcn slide templates inline editing', () => {
  describe('coverSlideJsxShadcn', () => {
    it('imports Editable', () => {
      const code = coverSlideJsxShadcn('My Talk', 'A subtitle', 'my-talk')
      expect(code).toContain("import { BottomBar, Editable, Slide } from '@deckio/deck-engine'")
    })

    it('wraps title in Editable', () => {
      const code = coverSlideJsxShadcn('My Talk', 'A subtitle', 'my-talk')
      expect(code).toContain('<Editable as="h1" id="cover.title"')
      expect(code).toContain('My Talk')
      expect(code).toContain('</Editable>')
    })

    it('wraps subtitle in Editable', () => {
      const code = coverSlideJsxShadcn('My Talk', 'A subtitle', 'my-talk')
      expect(code).toContain('<Editable as="p" id="cover.subtitle"')
      expect(code).toContain('A subtitle')
    })

    it('wraps metadata fields in Editable', () => {
      const code = coverSlideJsxShadcn('My Talk', 'A subtitle', 'my-talk')
      expect(code).toContain('<Editable as="span" id="cover.meta.project"')
      expect(code).toContain('<Editable as="span" id="cover.meta.date"')
      expect(code).toContain('<Editable as="span" id="cover.meta.stack"')
    })

    it('wraps footer in Editable within BottomBar', () => {
      const code = coverSlideJsxShadcn('My Talk', 'A subtitle', 'my-talk')
      expect(code).toContain('<BottomBar text={<Editable as="span" id="cover.footer">my-talk</Editable>}')
    })

    it('no longer uses BlurText for title/subtitle (direct Editable instead)', () => {
      const code = coverSlideJsxShadcn('My Talk', 'A subtitle', 'my-talk')
      expect(code).not.toContain('BlurText')
    })
  })

  describe('featuresSlideJsxShadcn', () => {
    it('imports Editable + EditableList', () => {
      const code = featuresSlideJsxShadcn('my-talk')
      expect(code).toContain("import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'")
    })

    it('wraps heading in Editable', () => {
      const code = featuresSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="h2" id="features.heading"')
    })

    it('wraps lead text in Editable', () => {
      const code = featuresSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="p" id="features.lead"')
    })

    it('wraps card titles in Editable with dynamic IDs', () => {
      const code = featuresSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="h3" id={`features.items.${f.id}.title`}')
    })

    it('wraps card descriptions in Editable', () => {
      const code = featuresSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="p" id={`features.items.${f.id}.desc`}')
    })

    it('features array items have id field for stable dynamic IDs', () => {
      const code = featuresSlideJsxShadcn('my-talk')
      expect(code).toContain("id: 'shadcn'")
      expect(code).toContain("id: 'animations'")
      expect(code).toContain("id: 'theme'")
      expect(code).toContain("id: 'export'")
    })
  })

  describe('gettingStartedSlideJsxShadcn', () => {
    it('imports Editable', () => {
      const code = gettingStartedSlideJsxShadcn('my-talk')
      expect(code).toContain("import { BottomBar, Editable, Slide } from '@deckio/deck-engine'")
    })

    it('wraps heading in Editable', () => {
      const code = gettingStartedSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="h2" id="gettingStarted.heading"')
    })

    it('wraps step titles in Editable', () => {
      const code = gettingStartedSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="h3" id="gettingStarted.step1.title"')
      expect(code).toContain('<Editable as="h3" id="gettingStarted.step2.title"')
      expect(code).toContain('<Editable as="h3" id="gettingStarted.step3.title"')
    })

    it('wraps tip content in Editable', () => {
      const code = gettingStartedSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="span" id="gettingStarted.tip">')
    })
  })

  describe('thankYouSlideJsxShadcn', () => {
    it('imports Editable', () => {
      const code = thankYouSlideJsxShadcn('my-talk')
      expect(code).toContain("import { BottomBar, Editable, Slide } from '@deckio/deck-engine'")
    })

    it('wraps title in Editable (plain text instead of DecryptedText)', () => {
      const code = thankYouSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="h2" id="thankYou.title"')
      expect(code).toContain('Thank You')
      expect(code).not.toContain('DecryptedText')
    })

    it('wraps link labels in Editable', () => {
      const code = thankYouSlideJsxShadcn('my-talk')
      expect(code).toContain('<Editable as="span" id="thankYou.link.github">github.com</Editable>')
      expect(code).toContain('<Editable as="span" id="thankYou.link.handle">yourhandle</Editable>')
    })

    it('wraps footer in Editable', () => {
      const code = thankYouSlideJsxShadcn('my-talk')
      expect(code).toContain('<BottomBar text={<Editable as="span" id="thankYou.footer">my-talk</Editable>}')
    })
  })
})

describe('AURORA_PALETTES', () => {
  it('is an array of at least 6 palettes', () => {
    expect(Array.isArray(AURORA_PALETTES)).toBe(true)
    expect(AURORA_PALETTES.length).toBeGreaterThanOrEqual(6)
  })

  it('each palette has value, label, hint, and 3 colors', () => {
    for (const p of AURORA_PALETTES) {
      expect(p).toHaveProperty('value')
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('hint')
      expect(p).toHaveProperty('colors')
      expect(p.colors).toHaveLength(3)
    }
  })

  it('all colors are valid hex codes', () => {
    for (const p of AURORA_PALETTES) {
      for (const c of p.colors) {
        expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
  })

  it('includes Ocean palette as first option', () => {
    expect(AURORA_PALETTES[0].value).toBe('ocean')
  })

  it('has unique palette values', () => {
    const values = AURORA_PALETTES.map((p) => p.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('includes all expected palettes', () => {
    const values = AURORA_PALETTES.map((p) => p.value)
    expect(values).toContain('ocean')
    expect(values).toContain('sunset')
    expect(values).toContain('forest')
    expect(values).toContain('nebula')
    expect(values).toContain('arctic')
    expect(values).toContain('minimal')
  })
})

describe('AURORA_ACCENT_MAP', () => {
  it('has an entry for every aurora palette', () => {
    for (const p of AURORA_PALETTES) {
      expect(AURORA_ACCENT_MAP).toHaveProperty(p.value)
    }
  })

  it('each accent is a valid hex color', () => {
    for (const hex of Object.values(AURORA_ACCENT_MAP)) {
      expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('maps ocean to sky blue (#0ea5e9)', () => {
    expect(AURORA_ACCENT_MAP.ocean).toBe('#0ea5e9')
  })

  it('maps sunset to orange (#f97316)', () => {
    expect(AURORA_ACCENT_MAP.sunset).toBe('#f97316')
  })

  it('maps forest to emerald (#10b981)', () => {
    expect(AURORA_ACCENT_MAP.forest).toBe('#10b981')
  })

  it('maps nebula to violet (#8b5cf6)', () => {
    expect(AURORA_ACCENT_MAP.nebula).toBe('#8b5cf6')
  })

  it('maps arctic to cyan (#06b6d4)', () => {
    expect(AURORA_ACCENT_MAP.arctic).toBe('#06b6d4')
  })

  it('maps minimal to zinc (#71717a)', () => {
    expect(AURORA_ACCENT_MAP.minimal).toBe('#71717a')
  })

  it('each accent matches the first color of its palette', () => {
    for (const p of AURORA_PALETTES) {
      expect(AURORA_ACCENT_MAP[p.value]).toBe(p.colors[0])
    }
  })
})

describe('auroraAccent', () => {
  it('returns the correct accent for known palettes', () => {
    expect(auroraAccent('ocean')).toBe('#0ea5e9')
    expect(auroraAccent('sunset')).toBe('#f97316')
    expect(auroraAccent('forest')).toBe('#10b981')
  })

  it('falls back to ocean accent for unknown palette', () => {
    expect(auroraAccent('nonexistent')).toBe('#0ea5e9')
  })

  it('falls back to ocean accent for undefined', () => {
    expect(auroraAccent(undefined)).toBe('#0ea5e9')
  })
})

describe('deckConfig with aurora', () => {
  it('includes aurora block when aurora config is provided', () => {
    const aurora = { palette: 'ocean', colors: ['#0ea5e9', '#6366f1', '#8b5cf6'] }
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn', aurora)
    expect(config).toContain("palette: 'ocean'")
    expect(config).toContain('colors:')
    expect(config).toContain('#0ea5e9')
  })

  it('omits aurora block when aurora is null', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn', null)
    expect(config).not.toContain('aurora')
    expect(config).not.toContain('palette')
  })

  it('omits aurora block by default', () => {
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'dark')
    expect(config).not.toContain('aurora')
  })

  it('works with different palettes', () => {
    const aurora = { palette: 'sunset', colors: ['#f97316', '#ef4444', '#ec4899'] }
    const config = deckConfig('s', 'T', 'S', '📦', '#000', 'shadcn', 'shadcn', aurora)
    expect(config).toContain("palette: 'sunset'")
    expect(config).toContain('#f97316')
  })
})

describe('packageJson with ogl dependency', () => {
  it('includes ogl when designSystem is shadcn', () => {
    const pkg = JSON.parse(packageJson('x', undefined, { designSystem: 'shadcn' }))
    expect(pkg.dependencies).toHaveProperty('ogl')
  })

  it('does NOT include ogl when designSystem is none', () => {
    const pkg = JSON.parse(packageJson('x', undefined, { designSystem: 'none' }))
    expect(pkg.dependencies).not.toHaveProperty('ogl')
  })

  it('does NOT include ogl by default', () => {
    const pkg = JSON.parse(packageJson('x'))
    expect(pkg.dependencies).not.toHaveProperty('ogl')
  })
})

describe('vscodeMcpConfig', () => {
  it('returns valid JSON', () => {
    expect(() => JSON.parse(vscodeMcpConfig())).not.toThrow()
  })

  it('has mcpServers.shadcn entry', () => {
    const json = JSON.parse(vscodeMcpConfig())
    expect(json.mcpServers).toHaveProperty('shadcn')
  })

  it('uses npx command', () => {
    const json = JSON.parse(vscodeMcpConfig())
    expect(json.mcpServers.shadcn.command).toBe('npx')
  })

  it('passes correct args for shadcn mcp', () => {
    const json = JSON.parse(vscodeMcpConfig())
    expect(json.mcpServers.shadcn.args).toEqual(['shadcn@latest', 'mcp'])
  })

  it('does not include env object', () => {
    const json = JSON.parse(vscodeMcpConfig())
    expect(json.mcpServers.shadcn.env).toBeUndefined()
  })

  it('ends with newline', () => {
    expect(vscodeMcpConfig().endsWith('\n')).toBe(true)
  })
})
