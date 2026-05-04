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

function readBundledEngineRef() {
  const scaffolderPkgPath = join(__dirname, 'package.json')

  try {
    if (!existsSync(scaffolderPkgPath)) return null
    const scaffolderPkg = JSON.parse(readFileSync(scaffolderPkgPath, 'utf-8'))
    const engineVersion = scaffolderPkg.deckio?.engineVersion
    return typeof engineVersion === 'string' && engineVersion ? engineVersion : null
  } catch {
    return null
  }
}

/**
 * Resolve the @deckio/deck-engine dependency reference for generated projects.
 *
 * Local dev (monorepo):  file: protocol pointing to the engine package
 * npm-installed:         bundled semver range from create-deckio package.json
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

  // Fallback: bundled published engine version from create-deckio metadata.
  return readBundledEngineRef() || 'latest'
}

export function resolveEngineVersionLabel(projectDir) {
  const enginePkgPath = join(__dirname, '..', 'deck-engine', 'package.json')

  try {
    if (existsSync(enginePkgPath)) {
      const enginePkg = JSON.parse(readFileSync(enginePkgPath, 'utf-8'))
      if (enginePkg.name === '@deckio/deck-engine') {
        return `v${enginePkg.version} (local workspace)`
      }
    }
  } catch { /* fall through to reference parsing */ }

  const ref = resolveEngineRef(projectDir)
  if (ref === 'latest') return 'latest'
  return `v${ref.replace(/^[~^]/, '')}`
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function packageJson(name, engineRef, { designSystem = 'none', theme = 'dark' } = {}) {
  if (!engineRef) engineRef = resolveEngineRef()
  const deps = {
    '@deckio/deck-engine': engineRef,
    react: '^19.1.0',
    'react-dom': '^19.1.0',
  }
  if (designSystem === 'shadcn') {
    deps['class-variance-authority'] = '^0.7.1'
    deps['clsx'] = '^2.1.1'
    deps['lucide-react'] = '^0.511.0'
    deps['motion'] = '^12.23.12'
    deps['ogl'] = '^1.0.11'
    deps['radix-ui'] = '^1.4.2'
    deps['tailwind-merge'] = '^3.3.0'
  }
  if (theme === 'fabric') {
    deps['@fabric-msft/svg-icons'] = '^7.0.1'
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
      '@tailwindcss/vite': '^4.2.2',
      '@vitejs/plugin-react': '^6.0.0',
      tailwindcss: '^4.2.2',
      vite: '^8.0.0',
    },
  }, null, 2) + '\n'
}

export function indexCss(theme = 'dark') {
  return `\
@import '@deckio/deck-engine/styles/global.css';
@import '@deckio/deck-engine/themes/${theme}.css';
`
}

export function mainJsx(theme = 'dark') {
  return `\
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`
}

export function deckConfig(slug, title, subtitle, icon, accent, theme = 'dark', designSystem = 'none', aurora = null, appearance = 'dark') {
  const esc = (s) => s.replace(/'/g, "\\'")
  const dsLine = designSystem !== 'none' ? `\n  designSystem: '${esc(designSystem)}',` : ''
  const appearanceLine = `\n  appearance: '${esc(appearance)}',`
  const auroraBlock = aurora ? `\n  aurora: {\n    palette: '${esc(aurora.palette)}',\n    colors: ${JSON.stringify(aurora.colors)},\n  },` : ''

  if (designSystem === 'shadcn') {
    return `\
import CoverSlide from './src/slides/CoverSlide.jsx'
import FeaturesSlide from './src/slides/FeaturesSlide.jsx'
import GettingStartedSlide from './src/slides/GettingStartedSlide.jsx'
import ThankYouSlide from './src/slides/ThankYouSlide.jsx'

export default {
  id: '${esc(slug)}',
  title: '${esc(title)}',
  subtitle: '${esc(subtitle)}',
  description: '${esc(subtitle)}',
  meta: {
    seededTemplate: true,
    contentStatus: 'sample',
    contextPolicy: 'ignore-sample-content-until-user-replaces-it',
  },
  icon: '${esc(icon)}',
  accent: '${esc(accent)}',
  theme: '${esc(theme)}',${dsLine}${appearanceLine}${auroraBlock}
  order: 1,
  slides: [
    CoverSlide,
    FeaturesSlide,
    GettingStartedSlide,
    ThankYouSlide,
  ],
}
`
  }

  if (theme === 'fabric') {
    return `\
import CoverSlide from './src/slides/CoverSlide.jsx'
import FabricIconsSlide from './src/slides/FabricIconsSlide.jsx'
import ThankYouSlide from './src/slides/ThankYouSlide.jsx'

export default {
  id: '${esc(slug)}',
  title: '${esc(title)}',
  subtitle: '${esc(subtitle)}',
  description: '${esc(subtitle)}',
  meta: {
    seededTemplate: true,
    contentStatus: 'sample',
    contextPolicy: 'ignore-sample-content-until-user-replaces-it',
  },
  icon: '${esc(icon)}',
  accent: '${esc(accent)}',
  theme: '${esc(theme)}',${dsLine}${appearanceLine}
  order: 1,
  slides: [
    CoverSlide,
    FabricIconsSlide,
    ThankYouSlide,
  ],
}
`
  }

  const tyImport = "import { GenericThankYouSlide as ThankYouSlide } from '@deckio/deck-engine'"
  return `\
import CoverSlide from './src/slides/CoverSlide.jsx'
${tyImport}

export default {
  id: '${esc(slug)}',
  title: '${esc(title)}',
  subtitle: '${esc(subtitle)}',
  description: '${esc(subtitle)}',
  meta: {
    seededTemplate: true,
    contentStatus: 'sample',
    contextPolicy: 'ignore-sample-content-until-user-replaces-it',
  },
  icon: '${esc(icon)}',
  accent: '${esc(accent)}',
  theme: '${esc(theme)}',${dsLine}${appearanceLine}
  order: 1,
  slides: [
    CoverSlide,
    ThankYouSlide,
  ],
}
`
}

export const FABRIC_OPTIMIZE_DEPS_INCLUDES = [
  '@fabric-msft/svg-icons/dist/Fabric32Color.js',
  '@fabric-msft/svg-icons/dist/PowerBi32Color.js',
  '@fabric-msft/svg-icons/dist/DataFactory32Color.js',
  '@fabric-msft/svg-icons/dist/DataEngineering32Color.js',
  '@fabric-msft/svg-icons/dist/DataWarehouse32Color.js',
  '@fabric-msft/svg-icons/dist/DataScience32Color.js',
  '@fabric-msft/svg-icons/dist/SqlDatabase32Item.js',
  '@fabric-msft/svg-icons/dist/RealTimeIntelligence32Color.js',
  '@fabric-msft/svg-icons/dist/GraphIntelligence32Color.js',
  '@fabric-msft/svg-icons/dist/Copilot32Color.js',
  '@fabric-msft/svg-icons/dist/OneLake32Color.js',
]

export function viteConfig({ designSystem = 'none', theme = 'dark' } = {}) {
  const aliasImport = designSystem === 'shadcn' ? "import path from 'path'\nimport { fileURLToPath } from 'url'\n\nconst __dirname = path.dirname(fileURLToPath(import.meta.url))\n\n" : ''
  const aliasBlock = designSystem === 'shadcn' ? `\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, 'src'),\n    },\n  },` : ''
  // Allow Vite to serve files from parent dirs (needed for file: protocol refs in local dev)
  const serverBlock = `\n  server: {\n    fs: {\n      allow: ['..', '../..'],\n    },\n  },`
  // Pre-bundle the 11 Fabric SVG icon entrypoints so the first browser request
  // does NOT trigger Vite's discover-then-reload optimizeDeps cycle (each icon
  // is its own dynamic import — without priming, Vite finds them at request
  // time, re-optimizes, and forces a full page reload).
  const optimizeBlock = theme === 'fabric'
    ? `\n  optimizeDeps: {\n    include: [\n${FABRIC_OPTIMIZE_DEPS_INCLUDES.map((entry) => `      '${entry}',`).join('\n')}\n    ],\n  },`
    : ''
  return `\
${aliasImport}import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { deckPlugin, tailwindPlugin } from '@deckio/deck-engine/vite'

export default defineConfig({
  plugins: [
    react({
      include: [/\\.[jt]sx?$/, /node_modules\\/@deckio\\/deck-engine\\/.+\\.jsx$/],
    }),
    deckPlugin({ inlineEditing: true }),
    tailwindPlugin(),
  ],${aliasBlock}${serverBlock}${optimizeBlock}
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

export function vscodeMcpConfig() {
  return JSON.stringify({
    mcpServers: {
      shadcn: {
        command: 'npx',
        args: ['shadcn@latest', 'mcp'],
      },
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

export const AURORA_PALETTES = [
  { value: 'ocean',   label: 'Ocean',   hint: 'blue, indigo, violet',    colors: ['#0ea5e9', '#6366f1', '#8b5cf6'] },
  { value: 'sunset',  label: 'Sunset',  hint: 'orange, red, pink',      colors: ['#f97316', '#ef4444', '#ec4899'] },
  { value: 'forest',  label: 'Forest',  hint: 'green, cyan, blue',      colors: ['#10b981', '#06b6d4', '#3b82f6'] },
  { value: 'nebula',  label: 'Nebula',  hint: 'purple, pink, rose',     colors: ['#8b5cf6', '#ec4899', '#f43f5e'] },
  { value: 'arctic',  label: 'Arctic',  hint: 'cyan, blue, indigo',     colors: ['#06b6d4', '#3b82f6', '#6366f1'] },
  { value: 'minimal', label: 'Minimal', hint: 'neutral zinc',           colors: ['#71717a', '#a1a1aa', '#d4d4d8'] },
]

/** Derive accent color from aurora palette — first color of the palette */
export const AURORA_ACCENT_MAP = {
  ocean:   '#0ea5e9',
  sunset:  '#f97316',
  forest:  '#10b981',
  nebula:  '#8b5cf6',
  arctic:  '#06b6d4',
  minimal: '#71717a',
}

/** Get the accent color for a given aurora palette name */
export function auroraAccent(paletteName) {
  return AURORA_ACCENT_MAP[paletteName] || AURORA_ACCENT_MAP.ocean
}

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

export function mcpGuide() {
  return `\
# MCP Authoring Guide

This deck is pre-configured for **MCP-powered component authoring** — the fastest way to
expand your presentation with new UI components using AI.

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) lets AI assistants like GitHub Copilot
interact with external tools and registries. The **shadcn MCP server** gives Copilot direct
access to the shadcn/ui and ReactBits component registries, so you can add components by
describing what you need in plain language.

## Setup

**Already done.** This project ships with \`.vscode/mcp.json\` pre-configured:

\`\`\`json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
\`\`\`

Open this project in VS Code or GitHub Codespaces and MCP is active immediately.

## Registry Architecture

This project uses **two component registries** that coexist in \`components.json\`:

| Registry | Prefix | What it provides |
|----------|--------|-----------------|
| **shadcn/ui** | *(none)* | UI primitives — Dialog, Tabs, Table, Input, Select, Accordion, etc. |
| **ReactBits** | \`@react-bits/\` | Animation & effect components — backgrounds, text effects, cards |

Both registries resolve components to \`src/components/ui/\` using the \`@/\` path alias.
They share infrastructure (\`cn()\` utility, Tailwind CSS, Radix primitives) and never conflict.

## Example Prompts — shadcn/ui Components

### Layout & structure
- *"Add the Dialog component from shadcn"*
- *"Add Sheet and Tabs from shadcn for a tabbed content slide"*
- *"Add Accordion from shadcn to build a collapsible FAQ section"*
- *"I need a data table — add the Table component from shadcn"*

### Form elements
- *"Add Input, Select, and Textarea from shadcn"*
- *"Add the Form component from shadcn for a contact slide"*
- *"Add Checkbox and Switch from shadcn"*

### Feedback & overlay
- *"Add Tooltip from shadcn for hover hints on my metrics"*
- *"Add Alert Dialog from shadcn for a confirmation overlay"*
- *"Add Toast from shadcn for notification examples"*
- *"Add Progress from shadcn for a loading bar demo"*

### Navigation & display
- *"Add Avatar from shadcn for team member photos"*
- *"Add Breadcrumb from shadcn for a navigation example"*
- *"Add Collapsible from shadcn for expandable sections"*

### Composite tasks
- *"What shadcn components would work best for a pricing comparison slide?"*
- *"Create a slide that uses Cards and Badges to compare three product tiers"*
- *"Build a team slide with Avatar, Card, and Badge components"*
- *"Add the components I need for an interactive demo slide with tabs and code blocks"*

## Example Prompts — ReactBits Components

### Backgrounds & effects
- *"Add Hyperspeed from React Bits for a dramatic section divider"*
- *"Show me all available backgrounds from React Bits"*
- *"Add Particles from React Bits for an ambient background effect"*

### Text animations
- *"Add LetterSwapForward from React Bits for an animated title"*
- *"Show me all text animations available in React Bits"*
- *"Add CountUp from React Bits for animated metric numbers"*

### Card & content effects
- *"Add TiltCard from React Bits for interactive team cards"*
- *"Add AnimatedContent from React Bits for scroll-triggered reveals"*
- *"Add a code block component from React Bits"*

## How Components Are Installed

When you ask Copilot to add a component (or run the CLI manually), this happens:

1. The shadcn CLI reads \`components.json\` for project configuration
2. It fetches the component source from the appropriate registry
3. The component file is written to \`src/components/ui/\`
4. Dependencies (if any) are added to \`package.json\` and installed

The component is now **yours** — it's a source file in your project, not an opaque dependency.
Modify it freely to match your presentation style.

## CLI Reference

The CLI equivalent of any MCP prompt:

\`\`\`bash
# Add shadcn/ui components
npx shadcn@latest add dialog
npx shadcn@latest add sheet tooltip tabs
npx shadcn@latest add accordion table avatar

# Add ReactBits components
npx shadcn@latest add @react-bits/code-block
npx shadcn@latest add @react-bits/animated-content
npx shadcn@latest add @react-bits/hyperspeed

# List what's available
npx shadcn@latest add
\`\`\`

## After Adding a Component

Import it in your slide:

\`\`\`jsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
\`\`\`

The \`@/\` alias resolves to \`src/\` — configured in \`vite.config.js\` and \`jsconfig.json\`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| MCP not responding in VS Code | Reload window (\`Cmd+Shift+P\` → "Reload Window") |
| Component not found | Check registry prefix: shadcn components have no prefix, ReactBits use \`@react-bits/\` |
| Import path error | All components go to \`src/components/ui/\` — use \`@/components/ui/<name>\` |
| Style conflicts | Components use the same Tailwind + CSS variable system — conflicts are rare; check for duplicate class names |
| Other editors | Run \`npx shadcn@latest mcp init --client <your-client>\` to configure for your editor |

## Preinstalled Components

These are already in your project — no need to add them:

**shadcn/ui:** Button, Card (7 sub-components), Badge, Separator, Alert
**ReactBits:** Aurora, BlurText, ShinyText, DecryptedText, SpotlightCard
**Wrappers:** MetricCard, SectionBadge, CalloutAlert (in \`src/components/presentation/\`)
`
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOTE: The default scaffold no longer ships an extra content slide.
   The previous "HighlightsSlide" introduced a card/grid layout that read as
   a shadcn-style surface inside otherwise default-themed decks (regression
   reported after deck-engine 1.14.0). Inline-edit coverage for the default
   scaffold is provided by the existing <Editable> wrappers on CoverSlide
   (eyebrow, title parts, subtitle, footer, meta). The shadcn scaffold keeps
   its own Features/GettingStarted slides via the shadcn-specific helpers
   below.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   shadcn-ready Starter Slide Templates
   
   When designSystem is "shadcn", these replace the default dark-theme
   starter slides with a cleaner editorial contract. They showcase the real
   setup we scaffold today: theme tokens, ReactBits accents, and optional
   shadcn CLI expansion — not preinstalled official primitives.
   ═══════════════════════════════════════════════════════════════════════════ */

export function coverSlideJsxShadcn(title, subtitle, slug) {
  return `\
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import styles from './CoverSlide.module.css'

export default function CoverSlide() {
  return (
    <Slide index={0} className={styles.cover}>
      <div className="content-frame content-gutter">
        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={styles.overline}>
              <Badge variant="outline" className={styles.overlineBadge}>
                <Editable as="span" id="cover.eyebrow" className={styles.overlineText}>${slug}</Editable>
              </Badge>
            </div>

            <Editable as="h1" id="cover.title" className={styles.title}>
              ${title}
            </Editable>

            <Editable as="p" id="cover.subtitle" className={styles.subtitle}>
              ${subtitle}
            </Editable>
          </div>

          <div className={styles.aside}>
            <Card className={styles.metaCard}>
              <CardContent className={styles.metaContent}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Project</span>
                  <Editable as="span" id="cover.meta.project" className={styles.metaValue}>${title}</Editable>
                </div>
                <Separator />
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Date</span>
                  <Editable as="span" id="cover.meta.date" className={styles.metaValue}>${new Date().getFullYear()}</Editable>
                </div>
                <Separator />
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Stack</span>
                  <Editable as="span" id="cover.meta.stack" className={styles.metaValue}>React + DECKIO</Editable>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BottomBar text={<Editable as="span" id="cover.footer">${slug}</Editable>} />
    </Slide>
  )
}
`
}

export const COVER_SLIDE_CSS_SHADCN = `\
.cover {
  background: color-mix(in oklch, var(--background) 85%, transparent);
  padding: 0 0 44px 0;
  overflow: hidden;
}

/* Two-column asymmetric layout */
.layout {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 64px;
  align-items: center;
  min-height: 0;
}

.main {
  display: flex;
  flex-direction: column;
}

/* Overline with Badge */
.overline {
  margin-bottom: 28px;
}

.overlineBadge {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 3px;
  text-transform: uppercase;
  padding: 4px 14px;
}

/* Title — large editorial type (BlurText renders a <p>) */
.title {
  font-size: clamp(44px, 5vw, 72px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -2.5px;
  color: var(--foreground);
  margin-bottom: 24px;
}

/* Overline text — matches ShinyText inline span */
.overlineText {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 3px;
  text-transform: uppercase;
}

/* Subtitle */
.subtitle {
  font-size: clamp(16px, 1.6vw, 19px);
  font-weight: 400;
  color: var(--muted-foreground);
  line-height: 1.7;
  max-width: 480px;
}

/* Aside card — vertical metadata using real Card + Separator */
.aside {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.metaCard {
  min-width: 220px;
  animation: card-enter 0.7s ease both;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.metaContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metaRow {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metaLabel {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted-foreground);
}

.metaValue {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}
`

export function featuresSlideJsxShadcn(slug) {
  return `\
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import SpotlightCard from '@/components/ui/spotlight-card'
// Wrapper components compose shadcn primitives into deck-friendly blocks.
// See src/components/presentation/ for the full set.
import SectionBadge from '@/components/presentation/SectionBadge'
import styles from './FeaturesSlide.module.css'

const features = [
  {
    id: 'shadcn',
    icon: '🧩',
    title: 'shadcn Ready',
    badge: 'UI',
    desc: 'shadcn/ui components pre-installed — Button, Card, Badge, Separator, and Alert. Add more with the CLI.',
    code: 'npx shadcn@latest add dialog sheet tabs',
    delay: '0s',
  },
  {
    id: 'animations',
    icon: '✨',
    title: 'ReactBits Animations',
    badge: 'Motion',
    desc: 'BlurText, SpotlightCard, DecryptedText — hover these cards to see the spotlight effect live.',
    code: '@react-bits/spotlight-card',
    delay: '0.12s',
  },
  {
    id: 'theme',
    icon: '🎨',
    title: 'Theme System',
    badge: 'Design',
    desc: 'Choose light or dark appearance during scaffolding. Set once, consistent everywhere.',
    code: 'Appearance via ThemeProvider',
    delay: '0.24s',
  },
  {
    id: 'export',
    icon: '📦',
    title: 'Export Anywhere',
    badge: 'Build',
    desc: 'Export to PDF, capture screenshots, or deploy as a static site. Your slides, your way.',
    code: 'npm run build',
    delay: '0.36s',
  },
]

export default function FeaturesSlide() {
  return (
    <Slide index={1} className={styles.slide}>
      <div className="content-frame content-gutter">
        <div className={styles.content}>
          <div className={styles.header}>
            <SectionBadge className={styles.eyebrow}>Capabilities</SectionBadge>
            <Editable as="h2" id="features.heading" className={styles.title}>What You Can Build</Editable>
            <Editable as="p" id="features.lead" className={styles.lead}>
              Everything you need to create polished, interactive presentations.
            </Editable>
          </div>

          <div className={styles.grid}>
            {features.map((f, i) => (
              <SpotlightCard
                key={i}
                className={styles.spotCard}
                spotlightColor="color-mix(in srgb, var(--accent) 25%, transparent)"
                style={{ animationDelay: f.delay }}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>{f.icon}</span>
                  <Editable as="h3" id={\`features.items.\${f.id}.title\`} className={styles.cardTitle}>{f.title}</Editable>
                  <Badge variant="secondary" className={styles.cardBadge}>
                    <Editable as="span" id={\`features.items.\${f.id}.badge\`}>{f.badge}</Editable>
                  </Badge>
                </div>
                <Editable as="p" id={\`features.items.\${f.id}.desc\`} className={styles.cardDesc}>{f.desc}</Editable>
                <Editable as="code" id={\`features.items.\${f.id}.code\`} className={styles.cardCode}>{f.code}</Editable>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </div>

      <BottomBar text={<Editable as="span" id="features.footer">${slug}</Editable>} />
    </Slide>
  )
}
`
}

export const FEATURES_SLIDE_CSS_SHADCN = `\
.slide {
  background: color-mix(in oklch, var(--background) 85%, transparent);
  padding: 0 0 44px 0;
  overflow: hidden;
}

.content {
  position: relative;
  z-index: 10;
}

.header {
  margin-bottom: 48px;
}

.eyebrow {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.title {
  font-size: clamp(32px, 3.5vw, 48px);
  font-weight: 800;
  letter-spacing: -1.5px;
  color: var(--foreground);
  margin-bottom: 12px;
  line-height: 1.1;
}

.lead {
  font-size: 16px;
  color: var(--muted-foreground);
  line-height: 1.6;
  max-width: 420px;
}

/* 2-column card grid — better for projection readability */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

/* SpotlightCard wrapper — override defaults for theme tokens */
.spotCard {
  background: var(--card) !important;
  border-color: var(--border) !important;
  border-radius: var(--radius) !important;
  padding: 28px !important;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: card-in 0.5s ease both;
  transition: border-color 0.25s, box-shadow 0.25s;
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cardHeader {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cardIcon {
  font-size: 24px;
  line-height: 1;
}

.cardTitle {
  font-size: 17px;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: -0.3px;
}

.cardBadge {
  margin-left: auto;
}

.cardDesc {
  font-size: 14px;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.cardCode {
  font-size: 12px;
  font-family: var(--font-mono, ui-monospace, monospace);
  color: var(--accent);
  background: var(--secondary);
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: calc(var(--radius) * 0.6);
  width: fit-content;
  margin-top: auto;
}
`

export function gettingStartedSlideJsxShadcn(slug) {
  return `\
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Lightbulb } from 'lucide-react'
// Wrapper components compose shadcn primitives into deck-friendly blocks.
// See src/components/presentation/ for the full set.
import SectionBadge from '@/components/presentation/SectionBadge'
import CalloutAlert from '@/components/presentation/CalloutAlert'
import styles from './GettingStartedSlide.module.css'

export default function GettingStartedSlide() {
  return (
    <Slide index={2} className={styles.slide}>
      <div className="content-frame content-gutter">
        <div className={styles.content}>
          <div className={styles.header}>
            <SectionBadge className={styles.eyebrow}>Workflow</SectionBadge>
            <Editable as="h2" id="gettingStarted.heading" className={styles.title}>Getting Started</Editable>
          </div>

          <div className={styles.timeline}>
            <div className={styles.step} style={{ animationDelay: '0s' }}>
              <div className={styles.stepIndicator}>
                <Badge className={styles.stepBadge}>1</Badge>
                <Separator className={styles.stepLine} />
              </div>
              <div className={styles.stepContent}>
                <Editable as="h3" id="gettingStarted.step1.title" className={styles.stepTitle}>Inspect</Editable>
                <div className={styles.codeBlock}>
                  <div className={styles.codeDots}>
                    <span /><span /><span />
                  </div>
                  <div className={styles.codeLine}>
                    <span className={styles.codeDim}>$</span> cat components.json && ls src/components/ui
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.step} style={{ animationDelay: '0.15s' }}>
              <div className={styles.stepIndicator}>
                <Badge className={styles.stepBadge}>2</Badge>
                <Separator className={styles.stepLine} />
              </div>
              <div className={styles.stepContent}>
                <Editable as="h3" id="gettingStarted.step2.title" className={styles.stepTitle}>Expand</Editable>
                <div className={styles.codeBlock}>
                  <div className={styles.codeDots}>
                    <span /><span /><span />
                  </div>
                  <div className={styles.codeLine}>
                    <span className={styles.codeDim}>$</span> npx shadcn@latest add dialog sheet tabs
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.step} style={{ animationDelay: '0.3s' }}>
              <div className={styles.stepIndicator}>
                <Badge className={styles.stepBadge}>3</Badge>
              </div>
              <div className={styles.stepContent}>
                <Editable as="h3" id="gettingStarted.step3.title" className={styles.stepTitle}>Compose</Editable>
                <div className={styles.codeBlock}>
                  <div className={styles.codeDots}>
                    <span /><span /><span />
                  </div>
                  <div className={styles.codeLine}>
                    <span className={styles.codeKeyword}>import</span> {"{"} Button {"}"} <span className={styles.codeKeyword}>from</span> <span className={styles.codeString}>'@/components/ui/button'</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CalloutAlert icon={<Lightbulb />} title="Pro tip" className={styles.tip}>
            <Editable as="span" id="gettingStarted.tip">Use the shadcn MCP server in VS Code for AI-assisted component expansion.</Editable>
          </CalloutAlert>
        </div>
      </div>

      <BottomBar text={<Editable as="span" id="gettingStarted.footer">${slug}</Editable>} />
    </Slide>
  )
}
`
}

export const GETTING_STARTED_SLIDE_CSS_SHADCN = `\
.slide {
  background: color-mix(in oklch, var(--background) 85%, transparent);
  padding: 0 0 44px 0;
  overflow: hidden;
}

.content {
  position: relative;
  z-index: 10;
}

.header {
  margin-bottom: 48px;
}

.eyebrow {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.title {
  font-size: clamp(32px, 3.5vw, 48px);
  font-weight: 800;
  letter-spacing: -1.5px;
  color: var(--foreground);
  line-height: 1.1;
}

/* Horizontal timeline layout */
.timeline {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 32px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: step-in 0.5s ease both;
}

@keyframes step-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stepIndicator {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stepBadge {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  padding: 0;
}

.stepLine {
  flex: 1;
}

.stepContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stepTitle {
  font-size: 18px;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: -0.2px;
}

/* Code editor block */
.codeBlock {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  color: var(--foreground);
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.codeDots {
  display: flex;
  gap: 6px;
  padding: 10px 14px 0;
}
.codeDots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
}

.codeLine {
  padding: 10px 14px 14px;
  line-height: 1.5;
}

.codeDim {
  color: var(--muted-foreground);
  margin-right: 8px;
}

.codeKeyword {
  color: var(--accent);
}

.codeString {
  color: var(--muted-foreground);
}

/* Pro-tip alert */
.tip {
  animation: step-in 0.5s ease 0.45s both;
}
`


export function thankYouSlideJsxShadcn(slug, slideIndex = 3) {
  return `\
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Github, AtSign } from 'lucide-react'
import styles from './ThankYouSlide.module.css'

export default function ThankYouSlide() {
  return (
    <Slide index={${slideIndex}} className={styles.slide}>
      <div className="content-frame content-gutter">
        <div className={styles.content}>
          <Separator className={styles.accentDash} />
          <Editable as="h2" id="thankYou.title" className={styles.title}>
            Thank You
          </Editable>
          <Editable as="p" id="thankYou.subtitle" className={styles.subtitle}>
            Let's build something great — together.
          </Editable>
          <div className={styles.links}>
            <Button variant="ghost" size="sm">
              <Github />
              <Editable as="span" id="thankYou.link.github">github.com</Editable>
            </Button>
            <Button variant="ghost" size="sm">
              <AtSign />
              <Editable as="span" id="thankYou.link.handle">yourhandle</Editable>
            </Button>
          </div>
        </div>
      </div>

      <BottomBar text={<Editable as="span" id="thankYou.footer">${slug}</Editable>} />
    </Slide>
  )
}
`
}

export function coverSlideJsxFabric(title, subtitle, slug) {
  return `\
/**
 * SAMPLE CONTENT ONLY
 * This slide contains scaffolded placeholder copy.
 * Agents must not use it as factual project context until the user replaces it.
 */
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { CopilotInFabricIcon, MicrosoftFabricIcon, OneLakeIcon, PowerBIIcon } from '../data/fabric-icons.js'
import styles from './CoverSlide.module.css'

export default function CoverSlide() {
  return (
    <Slide index={0} className={styles.cover}>
      <div className="accent-bar" />

      <div className="content-frame content-gutter">
        <div className={styles.shell}>
          <section className={styles.content}>
            <div className={styles.brandLine}>
              <span className={styles.microsoftMark} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
              <Editable as="span" id="cover.eyebrow">Microsoft Fabric</Editable>
            </div>

            <h1>
              <Editable as="span" id="cover.title">${title}</Editable>
            </h1>

            <Editable as="p" id="cover.subtitle" multiline className={styles.subtitle}>
              ${subtitle}
            </Editable>

            <div className={styles.meta}>
              <div>
                <span className={styles.metaLabel}>Platform</span>
                <span className={styles.metaValue}>Unified analytics</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Foundation</span>
                <span className={styles.metaValue}>OneLake</span>
              </div>
              <div>
                <span className={styles.metaLabel}>AI</span>
                <span className={styles.metaValue}>Copilot in Fabric</span>
              </div>
            </div>
          </section>

          <aside className={styles.fabricPanel} aria-label="Microsoft Fabric workloads">
            <div className={styles.panelHeader}>
              <MicrosoftFabricIcon className={styles.fabricIcon} fallback={<span className={styles.iconFallback}>F</span>} />
              <span>Fabric workload map</span>
            </div>
            <div className={styles.workloadStack}>
              <div className={styles.workload}>
                <OneLakeIcon className={styles.workloadIcon} fallback={<span className={styles.iconFallback}>OL</span>} />
                <span>OneLake</span>
              </div>
              <div className={styles.workload}>
                <PowerBIIcon className={styles.workloadIcon} fallback={<span className={styles.iconFallback}>BI</span>} />
                <span>Power BI</span>
              </div>
              <div className={styles.workload}>
                <CopilotInFabricIcon className={styles.workloadIcon} fallback={<span className={styles.iconFallback}>AI</span>} />
                <span>Copilot in Fabric</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <BottomBar text={<Editable as="span" id="cover.footer">Microsoft Fabric | unified analytics platform</Editable>} />
    </Slide>
  )
}
`
}

export const COVER_SLIDE_CSS_FABRIC = `\
.cover {
  background:
    radial-gradient(circle at 76% 18%, var(--glow-accent), transparent 30%),
    linear-gradient(180deg, var(--background) 0%, color-mix(in srgb, var(--secondary) 16%, var(--background)) 100%);
  padding: 0 0 44px 0;
  overflow: hidden;
}

.cover :global(.content-frame) {
  display: flex;
  align-items: center;
  min-height: 100%;
}

.shell {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr);
  gap: 64px;
  align-items: center;
  width: 100%;
}

.content {
  position: relative;
  z-index: 10;
}

.brandLine {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 26px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 2.1px;
  text-transform: uppercase;
}

.microsoftMark {
  display: grid;
  grid-template-columns: repeat(2, 9px);
  grid-template-rows: repeat(2, 9px);
  gap: 2px;
}

.microsoftMark span:nth-child(1) { background: #F25022; }
.microsoftMark span:nth-child(2) { background: #7FBA00; }
.microsoftMark span:nth-child(3) { background: #00A4EF; }
.microsoftMark span:nth-child(4) { background: #FFB900; }

.content h1 {
  max-width: 760px;
  margin: 0;
  color: var(--foreground);
  font-size: clamp(48px, 5.8vw, 76px);
  font-weight: 760;
  line-height: 1;
  letter-spacing: -2.2px;
}

.subtitle {
  max-width: 640px;
  margin: 24px 0 40px;
  color: var(--muted-foreground);
  font-size: clamp(18px, 1.8vw, 22px);
  line-height: 1.55;
}

.meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  max-width: 680px;
}

.meta > div {
  padding: 14px 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevated);
}

.metaLabel,
.metaValue {
  display: block;
}

.metaLabel {
  margin-bottom: 4px;
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.1px;
  text-transform: uppercase;
}

.metaValue {
  color: var(--primary);
  font-size: 14px;
  font-weight: 750;
}

.fabricPanel {
  position: relative;
  padding: 22px;
  background: color-mix(in srgb, var(--card) 92%, var(--secondary));
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-elevated);
}

.fabricPanel::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--accent);
}

.panelHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
  color: var(--primary);
  font-size: 15px;
  font-weight: 800;
}

.fabricIcon {
  width: 44px;
  height: 44px;
}

.workloadStack {
  display: grid;
  gap: 12px;
}

.workload {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--foreground);
  font-weight: 700;
}

.workloadIcon {
  width: 32px;
  height: 32px;
}

.iconFallback {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: var(--primary);
  background: var(--secondary);
  border-radius: var(--radius-md);
  font-size: 10px;
  font-weight: 800;
}

@media (max-width: 980px) {
  .shell {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .meta {
    grid-template-columns: 1fr;
  }
}
`

export function fabricIconsSlideJsx(slug, slideIndex = 1) {
  return `\
/**
 * SAMPLE CONTENT ONLY
 * This slide showcases the Microsoft Fabric workload icon set bundled with
 * the fabric theme. Replace the copy or swap workloads to match your story —
 * the per-icon dynamic imports keep the bundle lean.
 */
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import {
  CopilotInFabricIcon,
  DataEngineeringIcon,
  DataFactoryIcon,
  DataScienceIcon,
  DataWarehouseIcon,
  DatabasesIcon,
  FabricIQIcon,
  MicrosoftFabricIcon,
  OneLakeIcon,
  PowerBIIcon,
  RealTimeIntelligenceIcon,
} from '../data/fabric-icons.js'
import styles from './FabricIconsSlide.module.css'

const WORKLOADS = [
  { id: 'onelake', name: 'OneLake', tagline: 'Unified data lake', Icon: OneLakeIcon, fallback: 'OL' },
  { id: 'power-bi', name: 'Power BI', tagline: 'Business intelligence', Icon: PowerBIIcon, fallback: 'BI' },
  { id: 'data-factory', name: 'Data Factory', tagline: 'Integration & orchestration', Icon: DataFactoryIcon, fallback: 'DF' },
  { id: 'data-engineering', name: 'Data Engineering', tagline: 'Spark notebooks & pipelines', Icon: DataEngineeringIcon, fallback: 'DE' },
  { id: 'data-warehouse', name: 'Data Warehouse', tagline: 'Enterprise SQL warehouse', Icon: DataWarehouseIcon, fallback: 'DW' },
  { id: 'data-science', name: 'Data Science', tagline: 'ML experiments & models', Icon: DataScienceIcon, fallback: 'DS' },
  { id: 'databases', name: 'Databases', tagline: 'Operational data services', Icon: DatabasesIcon, fallback: 'DB' },
  { id: 'real-time-intelligence', name: 'Real-Time Intelligence', tagline: 'Streaming & KQL', Icon: RealTimeIntelligenceIcon, fallback: 'RT' },
  { id: 'fabric-iq', name: 'Fabric IQ', tagline: 'Graph & insights', Icon: FabricIQIcon, fallback: 'IQ' },
  { id: 'copilot-fabric', name: 'Copilot in Fabric', tagline: 'AI across the platform', Icon: CopilotInFabricIcon, fallback: 'AI' },
]

export default function FabricIconsSlide() {
  return (
    <Slide index={${slideIndex}} className={styles.slide}>
      <div className="accent-bar" />

      <div className="content-frame content-gutter">
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.brandLine}>
              <span className={styles.microsoftMark} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
              <Editable as="span" id="fabricIcons.eyebrow">Microsoft Fabric workloads</Editable>
            </div>
            <Editable as="h2" id="fabricIcons.title" className={styles.title}>
              One platform. Every analytics workload.
            </Editable>
            <Editable as="p" id="fabricIcons.subtitle" multiline className={styles.subtitle}>
              The official Fabric icon set ships with this deck. Each tile uses a per-icon
              dynamic import so only the workloads you reference end up in the bundle.
            </Editable>
          </header>

          <div className={styles.platformBadge}>
            <MicrosoftFabricIcon className={styles.platformIcon} fallback={<span className={styles.iconFallback}>F</span>} />
            <div>
              <span className={styles.platformLabel}>Platform</span>
              <span className={styles.platformValue}>Microsoft Fabric</span>
            </div>
          </div>

          <ul className={styles.grid} aria-label="Microsoft Fabric workload icons">
            {WORKLOADS.map(({ id, name, tagline, Icon, fallback }) => (
              <li key={id} className={styles.tile}>
                <span className={styles.tileIcon}>
                  <Icon className={styles.workloadIcon} fallback={<span className={styles.iconFallback}>{fallback}</span>} />
                </span>
                <span className={styles.tileBody}>
                  <span className={styles.tileName}>{name}</span>
                  <span className={styles.tileTagline}>{tagline}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BottomBar text={<Editable as="span" id="fabricIcons.footer">Microsoft Fabric | official @fabric-msft/svg-icons</Editable>} />
    </Slide>
  )
}
`
}

export const FABRIC_ICONS_SLIDE_CSS = `\
.slide {
  background:
    radial-gradient(circle at 14% 12%, var(--glow-accent), transparent 32%),
    radial-gradient(circle at 88% 90%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 36%),
    linear-gradient(180deg, var(--background) 0%, color-mix(in srgb, var(--secondary) 14%, var(--background)) 100%);
  padding: 0 0 44px 0;
  overflow: hidden;
}

.slide :global(.content-frame) {
  display: flex;
  align-items: center;
  min-height: 100%;
}

.shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 32px;
  width: 100%;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 880px;
}

.brandLine {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 2.1px;
  text-transform: uppercase;
}

.microsoftMark {
  display: grid;
  grid-template-columns: repeat(2, 9px);
  grid-template-rows: repeat(2, 9px);
  gap: 2px;
}

.microsoftMark span:nth-child(1) { background: #F25022; }
.microsoftMark span:nth-child(2) { background: #7FBA00; }
.microsoftMark span:nth-child(3) { background: #00A4EF; }
.microsoftMark span:nth-child(4) { background: #FFB900; }

.title {
  margin: 0;
  color: var(--foreground);
  font-size: clamp(36px, 4.4vw, 56px);
  font-weight: 760;
  line-height: 1.05;
  letter-spacing: -1.6px;
}

.subtitle {
  margin: 0;
  max-width: 760px;
  color: var(--muted-foreground);
  font-size: clamp(16px, 1.45vw, 19px);
  line-height: 1.55;
}

.platformBadge {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  width: fit-content;
  padding: 14px 22px 14px 18px;
  background: color-mix(in srgb, var(--card) 92%, var(--secondary));
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-elevated);
  position: relative;
  overflow: hidden;
}

.platformBadge::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--accent);
}

.platformIcon {
  width: 36px;
  height: 36px;
}

.platformLabel,
.platformValue {
  display: block;
  line-height: 1.1;
}

.platformLabel {
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.1px;
  text-transform: uppercase;
}

.platformValue {
  margin-top: 4px;
  color: var(--primary);
  font-size: 15px;
  font-weight: 750;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevated);
  transition: transform 180ms ease, border-color 180ms ease;
}

.tile:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.tileIcon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--secondary) 60%, var(--card));
}

.workloadIcon {
  width: 32px;
  height: 32px;
}

.tileBody {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tileName {
  color: var(--foreground);
  font-weight: 750;
  font-size: 15px;
  line-height: 1.2;
}

.tileTagline {
  color: var(--muted-foreground);
  font-size: 12.5px;
  line-height: 1.35;
}

.iconFallback {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: var(--primary);
  background: var(--secondary);
  border-radius: var(--radius-md);
  font-size: 10px;
  font-weight: 800;
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
`

export function thankYouSlideJsxFabric(slug, slideIndex = 1) {
  return `\
/**
 * SAMPLE CONTENT ONLY
 * This slide contains scaffolded placeholder copy.
 * Agents must not use it as factual project context until the user replaces it.
 */
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { CopilotInFabricIcon, MicrosoftFabricIcon, PowerBIIcon } from '../data/fabric-icons.js'
import styles from './ThankYouSlide.module.css'

export default function ThankYouSlide() {
  return (
    <Slide index={${slideIndex}} className={styles.slide}>
      <div className="accent-bar" />

      <div className="content-frame content-gutter">
        <div className={styles.content}>
          <div className={styles.brandLockup}>
            <span className={styles.microsoftMark} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span>Microsoft Fabric</span>
          </div>

          <div className={styles.iconHalo} aria-hidden="true">
            <MicrosoftFabricIcon className={styles.heroIcon} fallback={<span className={styles.iconFallback}>F</span>} />
          </div>

          <Editable as="h2" id="thankYou.title" className={styles.title}>
            Thank you
          </Editable>
          <Editable as="p" id="thankYou.subtitle" multiline className={styles.subtitle}>
            Build once across data, analytics, and AI with Microsoft Fabric.
          </Editable>

          <div className={styles.nextRow}>
            <div>
              <PowerBIIcon className={styles.nextIcon} fallback={<span className={styles.iconFallback}>BI</span>} />
              <span>Power BI-ready insights</span>
            </div>
            <div>
              <CopilotInFabricIcon className={styles.nextIcon} fallback={<span className={styles.iconFallback}>AI</span>} />
              <span>Copilot in Fabric workflows</span>
            </div>
          </div>
        </div>
      </div>

      <BottomBar text={<Editable as="span" id="thankYou.footer">Microsoft Fabric | OneLake, Power BI, and Copilot in Fabric</Editable>} />
    </Slide>
  )
}
`
}

export const THANK_YOU_SLIDE_CSS_FABRIC = `\
.slide {
  background:
    radial-gradient(circle at 50% 36%, var(--glow-accent), transparent 30%),
    var(--background);
  padding: 0 0 44px 0;
  overflow: hidden;
}

.slide :global(.content-frame) {
  display: grid;
  min-height: 100%;
  place-items: center;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 820px;
  text-align: center;
}

.brandLockup {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.microsoftMark {
  display: grid;
  grid-template-columns: repeat(2, 9px);
  grid-template-rows: repeat(2, 9px);
  gap: 2px;
}

.microsoftMark span:nth-child(1) { background: #F25022; }
.microsoftMark span:nth-child(2) { background: #7FBA00; }
.microsoftMark span:nth-child(3) { background: #00A4EF; }
.microsoftMark span:nth-child(4) { background: #FFB900; }

.iconHalo {
  display: grid;
  width: 112px;
  height: 112px;
  place-items: center;
  margin-bottom: 28px;
  background: color-mix(in srgb, var(--secondary) 34%, var(--card));
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow-elevated);
}

.heroIcon {
  width: 68px;
  height: 68px;
}

.title {
  margin: 0;
  color: var(--foreground);
  font-size: clamp(56px, 7vw, 92px);
  font-weight: 760;
  line-height: 1;
  letter-spacing: -3px;
}

.subtitle {
  max-width: 650px;
  margin: 22px 0 34px;
  color: var(--muted-foreground);
  font-size: clamp(18px, 1.9vw, 22px);
  line-height: 1.55;
}

.nextRow {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  width: min(680px, 100%);
}

.nextRow > div {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 18px;
  color: var(--primary);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevated);
  font-weight: 750;
}

.nextIcon {
  width: 28px;
  height: 28px;
}

.iconFallback {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: var(--primary);
  background: var(--secondary);
  border-radius: var(--radius-md);
  font-size: 10px;
  font-weight: 800;
}

@media (max-width: 760px) {
  .nextRow {
    grid-template-columns: 1fr;
  }
}
`

/* ═══════════════════════════════════════════════════════════════════════════
   Dark / Light Mode Components (shadcn design system only)

   Generated into scaffolded projects when designSystem is "shadcn".
   Uses .dark class on <html> + CSS variables — the standard shadcn pattern.
   ═══════════════════════════════════════════════════════════════════════════ */

export function themeProviderJsx() {
  return `\
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeProviderContext = createContext({
  theme: 'light',
  setTheme: () => null,
})

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'deckio-ui-theme',
}) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(storageKey) || defaultTheme,
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (t) => {
      localStorage.setItem(storageKey, t)
      setTheme(t)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeProviderContext)
}
`
}

export function appJsx({ designSystem = 'none', appearance = 'dark' } = {}) {
  if (designSystem === 'shadcn') {
    const defaultTheme = appearance === 'light' ? 'light' : 'dark'
    return `\
import { useEffect } from 'react'
import { InlineEditProvider, Navigation, SlideErrorBoundary, SlideProvider } from '@deckio/deck-engine'
import '@deckio/deck-engine/styles/editable.css'
import { ThemeProvider } from './components/theme-provider'
import Aurora from '@/components/ui/aurora'
import project from '../deck.config.js'
import inlineEdits from './data/inline-edits.json'

// Inline-edit overrides are dev-only. Production builds render the original
// source text and ignore the override map, matching Decision 63's posture.
const overrides = import.meta.env.DEV ? inlineEdits : {}

export default function App() {
  const { accent, id, slides, theme, title } = project
  const auroraColors = project.aurora?.colors ?? ['#0ea5e9', '#6366f1', '#8b5cf6']

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
    document.title = title
  }, [accent, title])

  return (
    <ThemeProvider defaultTheme="${defaultTheme}">
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <Aurora colorStops={auroraColors} amplitude={1.0} blend={0.5} speed={0.6} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          <InlineEditProvider overrides={overrides} project={id}>
            <SlideProvider totalSlides={slides.length} project={id} slides={slides} theme={theme}>
              <Navigation />
              <div className="deck" data-project-id={id}>
                {slides.map((SlideComponent, index) => (
                  <SlideErrorBoundary key={\`\${id}-slide-\${index}\`} index={index}>
                    <SlideComponent index={index} project={project} />
                  </SlideErrorBoundary>
                ))}
              </div>
            </SlideProvider>
          </InlineEditProvider>
        </div>
      </div>
    </ThemeProvider>
  )
}
`
  }

  return `\
import { useEffect } from 'react'
import { InlineEditProvider, Navigation, SlideErrorBoundary, SlideProvider } from '@deckio/deck-engine'
import '@deckio/deck-engine/styles/editable.css'
import project from '../deck.config.js'
import inlineEdits from './data/inline-edits.json'

// Inline-edit overrides are dev-only. Production builds render the original
// source text and ignore the override map, matching Decision 63's posture.
const overrides = import.meta.env.DEV ? inlineEdits : {}

export default function App() {
  const { accent, id, slides, theme, title } = project

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
    document.title = title
  }, [accent, title])

  return (
    <InlineEditProvider overrides={overrides} project={id}>
      <SlideProvider totalSlides={slides.length} project={id} slides={slides} theme={theme}>
        <Navigation />
        <div className="deck" data-project-id={id}>
          {slides.map((SlideComponent, index) => (
            <SlideErrorBoundary key={\`\${id}-slide-\${index}\`} index={index}>
              <SlideComponent index={index} project={project} />
            </SlideErrorBoundary>
          ))}
        </div>
      </SlideProvider>
    </InlineEditProvider>
  )
}
`
}

export const THANK_YOU_SLIDE_CSS_SHADCN = `\
.slide {
  background: color-mix(in oklch, var(--background) 85%, transparent);
  padding: 0 0 44px 0;
  overflow: hidden;
}

.content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.accentDash {
  width: 40px;
  height: 3px !important;
  background: var(--accent);
  border-radius: 2px;
  margin-bottom: 32px;
  animation: dash-in 0.6s ease both;
}

@keyframes dash-in {
  from {
    opacity: 0;
    width: 0;
  }
  to {
    opacity: 1;
    width: 40px;
  }
}

.title {
  font-size: clamp(56px, 7vw, 96px);
  font-weight: 800;
  letter-spacing: -3px;
  line-height: 1.05;
  color: var(--foreground);
  margin-bottom: 20px;
}

.subtitle {
  font-size: clamp(16px, 1.8vw, 20px);
  font-weight: 400;
  color: var(--muted-foreground);
  letter-spacing: 0.3px;
  line-height: 1.6;
  margin-bottom: 36px;
}

.shinySubtitle {
  font-size: clamp(16px, 1.8vw, 20px);
  font-weight: 400;
  letter-spacing: 0.3px;
  line-height: 1.6;
}

/* DecryptedText character styles */
.decryptedChar {
  color: var(--foreground);
}

.encryptedChar {
  color: var(--accent);
  opacity: 0.7;
}

.links {
  display: flex;
  align-items: center;
  gap: 8px;
  animation: links-in 0.7s ease both 0.3s;
}

@keyframes links-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`
