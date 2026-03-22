# Deck Squad — Routing Rules

## Routing Table

| Work Type | Primary | Backup | Scope |
|-----------|---------|--------|-------|
| Engine: slides, themes, components, scaffolder | @depaul | @messi | deck-engine |
| Engine: API surface, npm releases, architecture | @messi | @depaul | deck-engine |
| Launcher: React UI, server endpoints, preview | @depaul | @julian | deck-launcher |
| Launcher: product direction, Copilot integration | @julian | @depaul | deck-launcher |
| Platform: K8s manifests, Docker, Azure, deploy | @lautaro | @enzo | deck-saas-core |
| Platform: architecture, environment strategy | @enzo | @lautaro | deck-saas-core |
| Gateway: OAuth, sessions, proxy, provisioning | @licha | @cuti | deck-gateway |
| Gateway: auth policy, product direction | @cuti | @licha | deck-gateway |
| Unit tests — engine | @depaul | @messi | deck-engine |
| Unit tests — launcher | @depaul | @julian | deck-launcher |
| Integration tests — gateway auth | @licha | @cuti | deck-gateway |
| Infrastructure tests — manifests, builds | @lautaro | @enzo | deck-saas-core |
| E2E / smoke tests | @depaul | @lautaro | cross-cutting |
| Security testing | @licha | @cuti | cross-cutting |
| Deploy verification | @lautaro | @enzo | cross-cutting |
| Cross-product integration | Affected POs | — | multi-product |

## Issue Routing

1. **`squad` label** → Triage workflow auto-detects product, assigns PO
2. **`squad:{name}` label** → routes directly to that agent
3. **`product:{name}` label** → identifies which product is affected
4. **No label** → product PO triages based on repo/path

## Label Taxonomy

| Prefix | Purpose | Examples | Mutually exclusive? |
|--------|---------|---------|---------------------|
| `squad:` | Agent assignment | `squad:messi`, `squad:depaul` | No (PO + doer can coexist) |
| `product:` | Product affected | `product:deck-engine` | No (can be cross-product) |
| `go:` | Triage verdict | `go:yes`, `go:no`, `go:needs-research` | **Yes** |
| `type:` | Issue type | `type:feature`, `type:bug`, `type:docs`, `type:chore` | **Yes** |
| `priority:` | Priority | `priority:p0`, `priority:p1`, `priority:p2` | **Yes** |
| `release:` | Release target | `release:v1.0.0`, `release:backlog` | **Yes** |

Labels prefixed with `go:`, `type:`, `priority:`, and `release:` are mutually exclusive — the label enforce workflow auto-removes conflicts.

## Triage (for POs)

1. **Mine?** Does the change live in my product? If not, tag the right PO.
2. **Security?** Touches auth, secrets, crypto → tag @licha.
3. **Infrastructure?** K8s, Docker, Azure → tag @lautaro.
4. **Cross-cutting?** Affects multiple products → coordinate with other POs.
5. **Tests?** Every PR must include or update tests for the affected layer.

## Hard Rules

1. Security changes → @licha reviews
2. Infrastructure changes → @lautaro reviews
3. npm releases of `@deckio/deck-engine` → @messi signs off
4. AKS deployments → @enzo signs off
5. Auth policy changes → @cuti signs off
6. Breaking API changes → all affected POs sign off
7. PRs without tests for touched layers → blocked until tests added
