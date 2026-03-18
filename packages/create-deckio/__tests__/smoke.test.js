import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(__dirname, '..')

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
      writeFileSync(join(binDir, 'npm'), '#!/bin/sh\nexit 0\n')
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

      const sampleInstructions = readFileSync(join(projectDir, '.github', 'instructions', 'sample-content.instructions.md'), 'utf-8')
      expect(sampleInstructions).toContain('`deck.config.js`')
      expect(sampleInstructions).toContain('`__sample`')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})
