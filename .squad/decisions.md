# Deck Squad — Decisions

## Template

```markdown
## Decision N: {Title}
**Date:** YYYY-MM-DD  |  **Author:** {Agent}  |  **Status:** ✅ Adopted | 🔄 Proposed
**Scope:** {Product or cross-cutting}

### Context
### Decision
### Impact
```

---

## Decision 1: Product Ownership Model
**Date:** 2026-03-22  |  **Author:** Squad  |  **Status:** ✅ Adopted
**Scope:** Cross-cutting

### Context
Four products, different tech stacks. One lead can't deeply own all of them.

### Decision
Each product gets a dedicated PO with final authority. POs delegate implementation to specialized doers. Cross-product decisions require affected POs to agree.

### Impact
- ✅ Faster decisions — no single bottleneck
- ✅ Deep product knowledge per PO
- ⚠️ Cross-product coordination requires explicit communication

---

## Decision 2: Security Review Gate
**Date:** 2026-03-22  |  **Author:** Cuti, Licha  |  **Status:** ✅ Adopted
**Scope:** Cross-cutting

### Context
deck-gateway handles OAuth, session tokens, namespace provisioning. deck-launcher has optional auth. Auth bugs have platform-wide blast radius.

### Decision
Any change touching authentication, authorization, sessions, secrets, or crypto must be reviewed by @licha before merge. No exceptions.

### Impact
- ✅ Consistent security posture
- ⚠️ Adds review step for auth PRs — worth the tradeoff

---

## Decision 3: Testing Requirements by Layer
**Date:** 2026-03-22  |  **Author:** Squad  |  **Status:** ✅ Adopted
**Scope:** Cross-cutting

### Context
The platform spans from JSX slide components to Kubernetes deployments. A single test strategy doesn't cover all layers. Gaps at layer boundaries cause the hardest bugs.

### Decision

**Every PR must include tests for the layer it touches.** Ownership:

| Layer | Owner | Minimum bar |
|-------|-------|-------------|
| Unit — engine | De Paul | vitest: new/changed components have tests, theme loading verified, exports stable |
| Unit — launcher | De Paul | vitest + RTL: API handlers tested, React components covered for user-facing flows |
| Integration — gateway | Licha | Auth flow tests: OAuth happy/error paths, session expiry, handoff token lifecycle, proxy routing |
| Infrastructure | Lautaro | `kustomize build` passes, `docker build` succeeds, dry-run on manifest changes |
| E2E | De Paul | Playwright: gateway login → launcher project list → engine slide render (critical path) |
| Security | Licha | OWASP checklist on auth changes, no secrets in logs/errors, timing-safe comparisons |
| Deploy verification | Lautaro | Post-deploy: pods healthy, services reachable, TLS valid, rollback tested |

**POs define acceptance criteria** for what the tests must cover. Doers write and maintain the tests.

**PRs without tests for touched layers are blocked.**

### Impact
- ✅ Every layer has an explicit test owner — no gaps
- ✅ E2E tests catch cross-product integration bugs
- ✅ Security testing is not optional
- ⚠️ Initial investment to build test infrastructure per layer

---

## Decision 4: GitHub Projects V2 for Work Tracking
**Date:** 2026-03-22  |  **Author:** Squad  |  **Status:** ✅ Adopted
**Scope:** Cross-cutting

### Context
The squad spans four products across three repos under `deckio-art`. We need a single place to see all work, triage it, and track progress — without requiring agents to context-switch between repos.

### Decision

1. **One org-level GitHub Projects V2 board** on `deckio-art`, covering `deck-engine`, `deck-launcher`, and `deck-saas-core`
2. **Issues filed per product repo** — not a monorepo issue tracker. Each repo has its own issues, templates, and workflows.
3. **Shared issue template** (`squad-task.yml`) with product dropdown, type, priority, and acceptance criteria fields
4. **Three automation workflows** per repo (copied from `.squad/github/`):
   - `sync-squad-labels.yml` — seeds labels from team.md on push or manual trigger
   - `squad-triage.yml` — auto-detects product from issue content, assigns PO, adds labels
   - `squad-label-enforce.yml` — enforces mutual exclusivity for `go:`, `type:`, `priority:` label groups
5. **Label taxonomy** — `squad:*` (agent), `product:*` (product), `go:*` (triage), `type:*` (category), `priority:*` (urgency), `release:*` (target)

### Issue Lifecycle
1. Issue created → `squad` label auto-applied via template
2. Triage workflow → detects product → adds `product:*` + `squad:{po}` → PO notified
3. PO reviews → applies `go:yes` + `type:*` + `priority:*` → assigns doer via `squad:{doer}`
4. Doer works → PR → review → merge → issue closed

### Impact
- ✅ Single board visibility across all products
- ✅ Auto-triage reduces PO toil — they validate, not sort
- ✅ Mutually exclusive labels prevent conflicting states
- ✅ Per-repo issues keep context close to the code
- ⚠️ Workflows must be copied to each product repo (3 repos × 4 workflows + template)

---

## Decision 5: Doers Execute via Copilot Coding Agent
**Date:** 2026-03-22  |  **Author:** Squad  |  **Status:** ✅ Adopted
**Scope:** Cross-cutting

### Context
Doer charters (De Paul, Lautaro, Licha) define what to build, how to test, and what standards to follow. But charters are just documents — someone needs to execute them. GitHub Copilot Coding Agent can be assigned to issues and given custom instructions.

### Decision

**Doers are Copilot wearing a charter hat. POs are the humans in the loop.**

When a PO applies `go:yes` and a doer label (`squad:depaul`, `squad:lautaro`, `squad:licha`), the `squad-copilot-assign` workflow:

1. Reads the doer's charter from `.squad/agents/{doer}/charter.md`
2. Builds custom instructions that include the charter, coding standards, and test requirements
3. Assigns `copilot-swe-agent[bot]` to the issue with those instructions
4. Copilot creates a branch, implements, and opens a PR
5. The PO reviews the PR — this is the acceptance gate

**PO responsibilities in this model:**
- Write clear issue titles and acceptance criteria (Copilot's input quality = output quality)
- Apply `go:yes` + doer label only when the issue is well-defined
- Review PRs for correctness, test coverage, and charter compliance
- Request changes if the PR doesn't meet the charter's standards
- Merge when satisfied

**What Copilot gets as context:**
- The doer's full charter (role, expertise, code standards, test requirements)
- Instructions to read `.squad/team.md`, `.squad/routing.md`, `.squad/decisions.md`
- Rules: write tests, match conventions, stay in scope, flag security concerns

### Impact
- ✅ Doer charters become executable — not just documentation
- ✅ POs stay in control — nothing merges without their review
- ✅ Consistent implementation quality — same charter, same standards, every time
- ✅ 24/7 execution capacity — Copilot works when humans don't
- ⚠️ Issue quality matters more — vague issues produce vague PRs
- ⚠️ Copilot coding agent must be enabled per repo (Settings → Copilot → Coding agent)
