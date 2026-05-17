# Copilot Instructions — deck-engine monorepo

## Packages

| Package | Path | Registry |
|---|---|---|
| `@deckio/deck-engine` | `packages/deck-engine` | npm (public) |
| `create-deckio` | `packages/create-deckio` | npm (public) |

Each package versions independently. Push to `main` triggers `publish-engine.yml`, which publishes if the version in `package.json` is new.

## Versioning — quick rules

Follows [SemVer 2.0](https://semver.org/). Bump in the package whose source changed:

- **PATCH** — bug fixes, copy/CSS tweaks, refactors with no behavior change, docs. Copilot may bump directly.
- **MINOR** — new exports, new components/slides/themes, new CLI flags. Copilot may bump if clearly additive and non-breaking.
- **MAJOR** — removed/renamed exports, changed API signatures, dropped Node/React support. **Never bump automatically — always ask the maintainer.**

When in doubt, choose the lower bump. Pre-1.0 (`0.x.y`) treat minor as potentially breaking — prefer patch.

After bumping, run `npm install` from the repo root to sync `package-lock.json`.

## Releasing

For the full release procedure (checklist, release-notes template, workflow steps), read `.github/RELEASING.md`. Do that only when you actually intend to release.
