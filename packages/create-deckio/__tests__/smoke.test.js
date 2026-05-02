import { describe, it, expect } from 'vitest'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(__dirname, '..')
const engineInitScript = join(pkgRoot, '..', 'deck-engine', 'scripts', 'init-project.mjs')

/**
 * Create a temp directory with a fake npm shim so scaffolder doesn't
 * actually run npm install during tests.
 */
function makeTempWithNpmShim() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'create-deckio-smoke-'))
  const binDir = join(tempRoot, 'bin')
  mkdirSync(binDir, { recursive: true })
  if (process.platform === 'win32') {
    writeFileSync(join(binDir, 'npm.cmd'), '@echo off\r\nexit /b 0\r\n')
  } else {
    const npmShim = join(binDir, 'npm')
    writeFileSync(npmShim, '#!/bin/sh\nexit 0\n')
    chmodSync(npmShim, 0o755)
  }
  const PATH = `${binDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`
  return { tempRoot, PATH }
}

function makeTempWithFailingNpmShim() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'create-deckio-no-install-'))
  const binDir = join(tempRoot, 'bin')
  mkdirSync(binDir, { recursive: true })
  if (process.platform === 'win32') {
    writeFileSync(join(binDir, 'npm.cmd'), '@echo off\r\necho npm should not run 1>&2\r\nexit /b 42\r\n')
  } else {
    const npmShim = join(binDir, 'npm')
    writeFileSync(npmShim, '#!/bin/sh\necho npm should not run >&2\nexit 42\n')
    chmodSync(npmShim, 0o755)
  }
  const PATH = `${binDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`
  return { tempRoot, PATH }
}

describe('create-deckio package', () => {
  it('has a valid package.json with bin entry', async () => {
    const pkg = (await import(join(pkgRoot, 'package.json'), { with: { type: 'json' } })).default
    expect(pkg.bin).toBeDefined()
    expect(pkg.bin['create-deckio']).toBe('index.mjs')
  })

  it('entry point file exists on disk', () => {
    expect(existsSync(join(pkgRoot, 'index.mjs'))).toBe(true)
  })

  it('utils module exports are importable', async () => {
    const utils = await import(join(pkgRoot, 'utils.mjs'))
    expect(typeof utils.slugify).toBe('function')
    expect(typeof utils.packageJson).toBe('function')
    expect(typeof utils.deckConfig).toBe('function')
  })

  it('deckio.png branding asset exists', () => {
    expect(existsSync(join(pkgRoot, 'deckio.png'))).toBe(true)
  })

  it('scaffolds a deck in non-interactive mode', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'create-deckio-smoke-'))
    const binDir = join(tempRoot, 'bin')
    const projectName = 'fresh-user-deck'
    const projectDir = join(tempRoot, projectName)

    mkdirSync(binDir, { recursive: true })

    if (process.platform === 'win32') {
      writeFileSync(join(binDir, 'npm.cmd'), '@echo off\r\nexit /b 0\r\n')
    } else {
      const npmShim = join(binDir, 'npm')
      writeFileSync(npmShim, '#!/bin/sh\nexit 0\n')
      chmodSync(npmShim, 0o755)
    }

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), projectName],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH: `${binDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`,
            DECK_TITLE: 'Fresh User Deck',
            DECK_SUBTITLE: 'Smoke test scaffold',
            DECK_ICON: '🎴',
            DECK_ACCENT: '#6366f1',
            DECK_THEME: 'dark',
          },
        },
      )

      expect(existsSync(join(projectDir, 'package.json'))).toBe(true)
      expect(existsSync(join(projectDir, 'deck.config.js'))).toBe(true)
      expect(existsSync(join(projectDir, '.github', 'instructions', 'sample-content.instructions.md'))).toBe(true)
      // Decision 25: scaffolded decks must ship the deck-optimize-space skill so
      // imported / external decks get the same dry-run cleanup guidance.
      expect(existsSync(join(projectDir, '.github', 'skills', 'deck-optimize-space', 'SKILL.md'))).toBe(true)
      const optimizeSkill = readFileSync(join(projectDir, '.github', 'skills', 'deck-optimize-space', 'SKILL.md'), 'utf-8')
      expect(optimizeSkill).toMatch(/dry-run/i)
      expect(optimizeSkill).toMatch(/never silently delete/i)
      expect(optimizeSkill).toContain('.deckio-trash/')
      // AGENTS.md (copied from engine) should point at the skill.
      const scaffoldedAgents = readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8')
      expect(scaffoldedAgents).toContain('deck-optimize-space')
      // Decision 63: starter deck ships with inline-edit override file + Editable usage.
      expect(existsSync(join(projectDir, 'src', 'data', 'inline-edits.json'))).toBe(true)
      const inlineEdits = readFileSync(join(projectDir, 'src', 'data', 'inline-edits.json'), 'utf-8')
      expect(JSON.parse(inlineEdits)).toEqual({})
      const coverSlide = readFileSync(join(projectDir, 'src', 'slides', 'CoverSlide.jsx'), 'utf-8')
      expect(coverSlide).toContain('Editable')
      expect(coverSlide).toContain('id="cover.subtitle"')
      // BottomBar text is editable through the same public contract.
      expect(coverSlide).toContain('id="cover.footer"')

      // Regression guard (post-1.14.0): default scaffold must NOT ship the
      // shadcn-looking HighlightsSlide as a second slide. Inline-edit coverage
      // lives on CoverSlide instead. See Decision 63 + depaul-inline-theme-regression.
      expect(existsSync(join(projectDir, 'src', 'slides', 'HighlightsSlide.jsx'))).toBe(false)
      expect(existsSync(join(projectDir, 'src', 'slides', 'HighlightsSlide.module.css'))).toBe(false)

      const deckConfigContents = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfigContents).not.toContain('HighlightsSlide')
      // Default scaffold must not pull in shadcn-only artifacts.
      expect(deckConfigContents).not.toContain("designSystem: 'shadcn'")
      expect(existsSync(join(projectDir, 'components.json'))).toBe(false)
      expect(existsSync(join(projectDir, 'src', 'components', 'ui'))).toBe(false)
      // No shadcn primitive imports leaked into default cover slide.
      expect(coverSlide).not.toMatch(/@\/components\/ui\//)
      expect(coverSlide).not.toMatch(/from ['"]@\/components\//)

      execFileSync(process.execPath, [engineInitScript], {
        cwd: projectDir,
        stdio: 'pipe',
        env: {
          ...process.env,
        },
      })

      expect(existsSync(join(projectDir, '.github', 'instructions', 'sample-content.instructions.md'))).toBe(true)

      const sampleInstructions = readFileSync(join(projectDir, '.github', 'instructions', 'sample-content.instructions.md'), 'utf-8')
      expect(sampleInstructions).toContain('`deck.config.js`')
      expect(sampleInstructions).toContain('`__sample`')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})

describe('create-deckio dot directory (.)', () => {
  it('scaffolds into current directory when using .', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectDir = join(tempRoot, 'my-existing-folder')
    mkdirSync(projectDir, { recursive: true })

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), '.'],
        {
          cwd: projectDir,
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH,
            DECK_TITLE: 'Existing Folder Deck',
            DECK_THEME: 'dark',
          },
        },
      )

      expect(existsSync(join(projectDir, 'package.json'))).toBe(true)
      expect(existsSync(join(projectDir, 'deck.config.js'))).toBe(true)
      expect(existsSync(join(projectDir, 'src', 'slides', 'CoverSlide.jsx'))).toBe(true)

      // Verify slug is derived from directory name, not '.'
      const deckConfig = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfig).toContain('my-existing-folder')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('derives slug from directory basename when using .', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectDir = join(tempRoot, 'quarterly-review')
    mkdirSync(projectDir, { recursive: true })

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), '.'],
        {
          cwd: projectDir,
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH,
            DECK_TITLE: 'Quarterly Review',
            DECK_THEME: 'dark',
          },
        },
      )

      const pkgJson = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'))
      expect(pkgJson.name).toBe('deck-project-quarterly-review')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})

describe('create-deckio CLI flags', () => {
  it('--help flag shows usage without creating files', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()

    try {
      const output = execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), '--help'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: { ...process.env, PATH },
        },
      ).toString()

      expect(output).toContain('--title')
      expect(output).toContain('--subtitle')
      expect(output).toContain('--icon')
      expect(output).toContain('--theme')
      expect(output).toContain('--appearance')
      expect(output).toContain('--palette')
      expect(output).toContain('--accent')
      expect(output).toContain('--no-install')
      expect(output).toContain('scaffold in current directory')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('--no-install scaffolds and initializes without running npm install', () => {
    const { tempRoot, PATH } = makeTempWithFailingNpmShim()
    const projectName = 'skip-install-test'
    const projectDir = join(tempRoot, projectName)

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), projectName, '--no-install'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH,
            DECK_TITLE: 'Skip Install Test',
            DECK_THEME: 'dark',
          },
        },
      )

      expect(existsSync(join(projectDir, 'package.json'))).toBe(true)
      expect(existsSync(join(projectDir, 'node_modules'))).toBe(false)
      expect(existsSync(join(projectDir, '.github', 'memory', 'state.md'))).toBe(true)
      expect(existsSync(join(projectDir, '.github', 'eyes'))).toBe(true)
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('--title flag overrides DECK_TITLE env var', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectName = 'flag-title-test'
    const projectDir = join(tempRoot, projectName)

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), projectName, '--title', 'Flag Title Wins'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH,
            DECK_TITLE: 'Env Title Loses',
            DECK_THEME: 'dark',
          },
        },
      )

      const deckConfig = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfig).toContain('Flag Title Wins')
      expect(deckConfig).not.toContain('Env Title Loses')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('--theme shadcn with --palette creates shadcn project', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectName = 'flag-shadcn-test'
    const projectDir = join(tempRoot, projectName)

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), projectName, '--theme', 'shadcn', '--palette', 'sunset', '--appearance', 'dark'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: { ...process.env, PATH },
        },
      )

      expect(existsSync(join(projectDir, 'components.json'))).toBe(true)
      expect(existsSync(join(projectDir, 'jsconfig.json'))).toBe(true)
      expect(existsSync(join(projectDir, 'src', 'components', 'ui', 'button.jsx'))).toBe(true)

      const deckConfig = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfig).toContain("designSystem: 'shadcn'")
      expect(deckConfig).toContain('sunset')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('--theme fabric creates fabric project', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectName = 'flag-fabric-test'
    const projectDir = join(tempRoot, projectName)

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), projectName, '--theme', 'fabric'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: { ...process.env, PATH },
        },
      )

      const deckConfig = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfig).toContain('fabric')

      const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'))
      expect(pkg.dependencies['@fabric-msft/svg-icons']).toBe('^7.0.1')

      const fabricIconsPath = join(projectDir, 'src', 'data', 'fabric-icons.js')
      expect(existsSync(fabricIconsPath)).toBe(true)
      const fabricIcons = readFileSync(fabricIconsPath, 'utf-8')
      expect(fabricIcons).toContain("import('@fabric-msft/svg-icons')")
      expect(fabricIcons).toContain('preloadFabricIcons')
      expect(fabricIcons).toContain('Fabric32Color')
      expect(fabricIcons).toContain('PowerBi32Color')
      expect(fabricIcons).toContain('DataFactory32Color')
      expect(fabricIcons).toContain('RealTimeIntelligence32Color')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('--accent flag sets custom accent color', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectName = 'flag-accent-test'
    const projectDir = join(tempRoot, projectName)

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), projectName, '--accent', '#ff5500', '--theme', 'default', '--appearance', 'dark'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: { ...process.env, PATH },
        },
      )

      const deckConfig = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfig).toContain('#ff5500')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('rejects invalid --accent hex format', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), 'bad-accent', '--accent', 'not-a-hex'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: { ...process.env, PATH },
        },
      )
      // Should not reach here
      expect.unreachable('Should have thrown on invalid accent')
    } catch (err) {
      expect(err.status).not.toBe(0)
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('flags + dot directory work together', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectDir = join(tempRoot, 'combined-test')
    mkdirSync(projectDir, { recursive: true })

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), '.', '--title', 'Combined Test', '--subtitle', 'Flag + Dot', '--theme', 'default', '--appearance', 'light', '--accent', '#10b981'],
        {
          cwd: projectDir,
          stdio: 'pipe',
          env: { ...process.env, PATH },
        },
      )

      expect(existsSync(join(projectDir, 'deck.config.js'))).toBe(true)
      const deckConfig = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfig).toContain('Combined Test')
      expect(deckConfig).toContain('Flag + Dot')
      expect(deckConfig).toContain('#10b981')
      expect(deckConfig).toContain('combined-test')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})
