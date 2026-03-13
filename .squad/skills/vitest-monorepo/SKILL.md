# Skill: Vitest Monorepo Test Setup

## When to use
Setting up Vitest in an npm workspaces monorepo where each package needs independent test execution.

## Pattern

1. Install `vitest` as a root dev dependency.
2. Create `vitest.workspace.js` at root:
   ```js
   export default ['packages/*']
   ```
3. Each package gets its own `vitest.config.js`:
   ```js
   import { defineConfig } from 'vitest/config'
   export default defineConfig({
     test: { include: ['__tests__/**/*.test.{js,mjs}'] },
   })
   ```
4. Root `package.json` script: `"test": "npx vitest run"`
5. Per-package script: `"test": "npx vitest run"`

## Key insight
If a module auto-runs on import (e.g., CLI entry points that call `main()` at module scope), extract pure functions into a separate `utils.mjs` and import them in both the entry point and tests.

## Files involved
- `vitest.workspace.js` — workspace root
- `packages/<pkg>/vitest.config.js` — per-package config
- `packages/<pkg>/__tests__/*.test.js` — test files
