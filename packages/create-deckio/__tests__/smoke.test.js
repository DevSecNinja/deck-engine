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
      expect(output).toContain('scaffold in current directory')
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

  it('--theme funky-punk creates funky-punk project', () => {
    const { tempRoot, PATH } = makeTempWithNpmShim()
    const projectName = 'flag-funky-test'
    const projectDir = join(tempRoot, projectName)

    try {
      execFileSync(
        process.execPath,
        [join(pkgRoot, 'index.mjs'), projectName, '--theme', 'funky-punk'],
        {
          cwd: tempRoot,
          stdio: 'pipe',
          env: { ...process.env, PATH },
        },
      )

      const deckConfig = readFileSync(join(projectDir, 'deck.config.js'), 'utf-8')
      expect(deckConfig).toContain('funky-punk')
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
