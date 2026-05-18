import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const engineRoot = join(__dirname, '..')
const repoPackagesRoot = join(engineRoot, '..')

function readEngineFile(...parts) {
  return readFileSync(join(engineRoot, ...parts), 'utf-8')
}

describe('inline editing authoring guidance', () => {
  it('ships dedicated inline editing instructions for slide JSX', () => {
    const source = readEngineFile('instructions', 'inline-editing.instructions.md')

    expect(source).toContain('Wrap **user-facing presentation content**')
    // Tolerate co-imports (e.g. `import { Editable, EditableList } from …`)
    // introduced when v1.17.0 added the EditableList primitive alongside
    // Editable. The instructions must teach the named-import pattern, not
    // any specific co-import permutation.
    expect(source).toMatch(/import \{[^}]*\bEditable\b[^}]*\} from '@deckio\/deck-engine'/)
    expect(source).toContain('BottomBar footer pattern')
    expect(source).toContain('Always wrap user-facing text in `<Editable>` by default')
  })

  it('teaches deck-add-slide to use Editable for new user-facing copy', () => {
    const source = readEngineFile('skills', 'deck-add-slide', 'SKILL.md')

    expect(source).toContain('Inline editing contract')
    expect(source).toContain('Import `Editable`')
    expect(source).toContain('Wrap titles, subtitles, body copy')
    expect(source).toContain('Always wrap `BottomBar text` in `<Editable')
  })

  it('teaches deck validation to catch missing Editable wrappers', () => {
    const source = readEngineFile('skills', 'deck-validate-project', 'SKILL.md')

    expect(source).toContain('Imports `Editable`')
    expect(source).toContain('Wraps titles, subtitles, body copy')
    expect(source).toContain('User-facing slide copy is editable via `<Editable>`')
  })

  it('keeps the create-deckio fallback AGENTS template aligned with engine instructions', () => {
    const source = readFileSync(join(repoPackagesRoot, 'create-deckio', 'index.mjs'), 'utf-8')

    expect(source).toContain('\\`Editable\\`, \\`GenericThankYouSlide\\`')
    expect(source).toContain('inline editing, and deck.config.js')
  })
})
