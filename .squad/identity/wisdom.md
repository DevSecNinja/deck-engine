---
last_updated: 2026-03-13T22:35:00Z
---

# Team Wisdom

Reusable patterns and heuristics learned through work. NOT transcripts — each entry is a distilled, actionable insight.

## Patterns

**Pattern:** `file:` protocol workspace deps create symlinks, and Vite blocks those parent-path reads unless `server.fs.allow` explicitly includes the engine path. **Context:** Local scaffolder smoke tests and fresh-project dev servers.

**Pattern:** CSS Modules are unlayered, so they can beat `@layer components` rules. Keep slide root classes simple and let inner wrappers handle stacking/context work. **Context:** Tailwind v4 + CSS Module coexistence in scaffolded slides.

**Pattern:** Separate browser and Node entry points aggressively. Browser bundles must never transitively import `fs`, `path`, or other Node builtins; keep that logic in `vite.js` or other server-only files. **Context:** Preventing production build crashes.

**Pattern:** Theme and design system are different axes. Theme controls CSS tokens and visual language; design system controls the component library/tooling layer. **Context:** CLI prompts, descriptors, and architecture decisions.

**Pattern:** Skills need complete skeletons per design system. If the AI has to “use judgment” to decide the base structure, the skill is underspecified. **Context:** Authoring reliable deck skills for autonomous coding CLIs.

**Pattern:** Copy engine assets before `npm install`. Skills, instructions, and AGENTS must land in the generated deck even when install or postinstall steps fail. **Context:** Resilient scaffolder bootstrapping.

**Pattern:** Tailwind v4 layer order matters: `@layer theme, base, components, utilities;` must be declared in the engine stylesheet so downstream utilities and ecosystem components cascade correctly. **Context:** shadcn compatibility and token layering.

**Pattern:** Aurora belongs in the app shell, not individual slides. Render it once in `App.jsx` on a fixed background layer so it persists across navigation. **Context:** ReactBits integration for shadcn decks.

**Pattern:** Semi-transparent surfaces (`color-mix(...)`) are the right way to let decorative backgrounds breathe through polished cards and slide shells. **Context:** shadcn slide styling over Aurora and other decorative layers.

**Pattern:** Use real Unicode characters inside generated template literals when you want visible symbols. **Context:** Scaffolded JSX strings and starter slide content.

## PR & Ship Hygiene (learned from PR #1)

**Pattern:** Test the full user loop before opening a PR: scaffold → use skills → inspect output. Feature-level unit tests aren't enough — the end-to-end experience (what a dev actually sees) is the real gate. **Context:** Skills passed all tests but generated dark-theme slides in shadcn projects because nobody tested the whole flow.

**Pattern:** Gitignore test artifacts immediately. Playwright screenshots, test slide outputs, and any generated verification files must NEVER land in a PR — add ignore rules before the first test run, not after cleanup. **Context:** PR #1 had 14k lines because screenshots and test slides were checked in.

**Pattern:** .squad/ state files add significant noise to PRs. Orchestration logs, session logs, and large history files inflate diffs. Consider a lean `.squad/.gitignore` that tracks only decisions.md, team.md, routing.md, charters, and templates — omit logs and orchestration-log from commits to feature branches. **Context:** PR #1 review was harder because .squad noise mixed with real code changes.

**Pattern:** Bump the package version as part of the feature work, not as an afterthought. If the work changes the public API or user experience, the version bump is part of the deliverable. **Context:** Ali had to ask "did we bump the version?" — nobody remembered.

**Pattern:** Always prefer ecosystem components over custom implementations. Before building anything, check if ReactBits, shadcn, or another established library already has it. Reinventing = wasted time + maintenance burden. **Context:** Ali's directive after catching us building components from scratch.

**Pattern:** Appearance mode (dark/light) is a scaffold-time choice, not a runtime toggle. Don't ship a ModeToggle component — the user picks during `create-deckio` and it's baked in. **Context:** Simplifies the theme system and avoids confusing UX with dual theme controls.

## Anti-Patterns

**Avoid:** Putting `position: relative` on slide root CSS module classes when the design depends on a global decorative layer. **Why:** It creates the wrong stacking context and can trap slide-specific backgrounds over Aurora.

**Avoid:** Encoding visible characters as escape sequences like `\u2728` in generated template strings. **Why:** The literal escape can survive into output instead of rendering the intended symbol (`✨`).

**Avoid:** Hardcoding theme-specific patterns in skills. **Why:** Every new theme requires editing every skill. Use descriptors — each theme ships its own AI-readable recipe, skills just reference it.

**Avoid:** Opening PRs with uncommitted test artifacts, screenshots, or generated files. **Why:** Inflates the diff, obscures real changes, and makes review painful.
