import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const engineRoot = join(__dirname, '..')
const repoPackagesRoot = join(engineRoot, '..')

function readEngineFile(...parts) {
  return readFileSync(join(engineRoot, ...parts), 'utf-8')
}

describe('deck-optimize-space skill', () => {
  it('ships a SKILL.md in the engine package', () => {
    const skillPath = join(engineRoot, 'skills', 'deck-optimize-space', 'SKILL.md')
    expect(existsSync(skillPath)).toBe(true)
  })

  it('declares itself as dry-run / report-first and forbids silent deletion', () => {
    const source = readEngineFile('skills', 'deck-optimize-space', 'SKILL.md')

    expect(source).toMatch(/dry-run/i)
    expect(source).toMatch(/report (only|first)/i)
    expect(source).toMatch(/never silently delete/i)
  })

  it('classifies candidates as safe / review-required / never-delete', () => {
    const source = readEngineFile('skills', 'deck-optimize-space', 'SKILL.md')

    expect(source).toMatch(/Safe/)
    expect(source).toMatch(/Review-required/i)
    expect(source).toMatch(/Never delete/i)
    // Concrete safe-bucket items
    expect(source).toContain('dist/')
    expect(source).toContain('.vite/')
    // Concrete never-delete items
    expect(source).toContain('deck.config.js')
    expect(source).toContain('package.json')
    expect(source).toContain('src/data/')
    expect(source).toMatch(/\.git\//)
  })

  it('describes conservative reference checks across config, JSX/JS, CSS, data, and public', () => {
    const source = readEngineFile('skills', 'deck-optimize-space', 'SKILL.md')

    expect(source).toContain('deck.config.js')
    expect(source).toMatch(/JSX ?\/ ?JS/i)
    expect(source).toMatch(/import .* from/i)
    expect(source).toMatch(/url\(/)
    expect(source).toContain('src/data')
    expect(source).toContain('public/')
    expect(source).toMatch(/treat .* as referenced/i)
  })

  it('prefers quarantine + manifest over unlink for approved cleanup', () => {
    const source = readEngineFile('skills', 'deck-optimize-space', 'SKILL.md')

    expect(source).toContain('.deckio-trash/')
    expect(source).toContain('manifest.json')
    expect(source).toMatch(/do \*?\*?not\*?\*? `?unlink`?/i)
  })
})

describe('engine AGENTS.md space hygiene', () => {
  it('points agents at the deck-optimize-space skill', () => {
    const source = readEngineFile('instructions', 'AGENTS.md')

    expect(source).toMatch(/Space hygiene/i)
    expect(source).toContain('.github/skills/deck-optimize-space/SKILL.md')
  })

  it('encodes the dry-run + no-silent-delete + quarantine contract', () => {
    const source = readEngineFile('instructions', 'AGENTS.md')

    expect(source).toMatch(/dry-run/i)
    expect(source).toMatch(/never silently delete/i)
    expect(source).toMatch(/review-required/i)
    expect(source).toContain('.deckio-trash/')
  })
})

describe('create-deckio fallback AGENTS template', () => {
  it('mentions the deck-optimize-space skill so externally imported decks still get the guidance', () => {
    const source = readFileSync(join(repoPackagesRoot, 'create-deckio', 'index.mjs'), 'utf-8')

    expect(source).toContain('deck-optimize-space')
    expect(source).toMatch(/Space hygiene/i)
    expect(source).toMatch(/dry-run/i)
    expect(source).toMatch(/never silently delete/i)
    expect(source).toContain('.deckio-trash/')
  })
})
