# Deck Squad — Team Roster

## Agents

| Agent | Role | Product Scope | Charter | Status |
|-------|------|---------------|---------|--------|
| **Messi** | Product Owner | deck-engine | [charter](agents/messi/charter.md) | ✅ Active |
| **Julian** | Product Owner | deck-launcher | [charter](agents/julian/charter.md) | ✅ Active |
| **Enzo** | Product Owner | deck-saas-core | [charter](agents/enzo/charter.md) | ✅ Active |
| **Cuti** | Product Owner | deck-gateway | [charter](agents/cuti/charter.md) | ✅ Active |
| **De Paul** | Code Expert + Test Lead | deck-engine, deck-launcher, E2E | [charter](agents/depaul/charter.md) | ✅ Active |
| **Lautaro** | Infrastructure & DevOps | deck-saas-core, deploy verification | [charter](agents/lautaro/charter.md) | ✅ Active |
| **Licha** | Security & Auth | deck-gateway, security testing | [charter](agents/licha/charter.md) | ✅ Active |

## Products

| Product | Repo | Tech | PO | Doer |
|---------|------|------|----|------|
| **deck-engine** | `deckio-art/deck-engine` | JSX, Vite, CSS themes, vitest, npm | Messi | De Paul |
| **deck-launcher** | `deckio-art/deck-launcher` | React 19, Node.js, Vite, Copilot SDK | Julian | De Paul |
| **deck-saas-core** | `deckio-art/deck-saas-core` | K8s, Docker, Azure Bicep, Kustomize | Enzo | Lautaro |
| **deck-gateway** | `deckio-art/deck-saas-core` → `apps/deck-gateway/` | Pure Node.js HTTP, crypto, GitHub OAuth, K8s API | Cuti | Licha |

## Testing Matrix

| Layer | Owner | Tools | What |
|-------|-------|-------|------|
| Unit — engine | De Paul | vitest | Slide components, themes, exports, scaffolder |
| Unit — launcher | De Paul | vitest + React Testing Library | React UI, API route handlers |
| Integration — gateway | Licha | Node.js test harness | OAuth flow, session lifecycle, handoff tokens, proxy |
| Infrastructure | Lautaro | `kustomize build`, `docker build`, `kubectl --dry-run` | Manifests, Dockerfile, deploy scripts |
| E2E / Smoke | De Paul | Playwright | Full flow: gateway → launcher → engine render |
| Security | Licha | OWASP ZAP, manual review | Auth boundaries, injection, secrets exposure |
| Deploy verification | Lautaro | Post-deploy scripts | Pod health, service reachability, TLS, rollback |

**Rule:** Every PR must include or reference tests for the layer it touches. POs define acceptance criteria; doers write and maintain tests.

## Ownership Model

**POs** have final say on their product — they prioritize, triage, make architecture calls, and approve changes. They don't write code; they define what "done" looks like, review PRs, and merge.

**Doers** are personas executed by **GitHub Copilot Coding Agent**. When a PO marks an issue `go:yes` and assigns a doer label (`squad:depaul`, `squad:lautaro`, `squad:licha`), the `squad-copilot-assign` workflow auto-assigns `copilot-swe-agent[bot]` with the doer's charter as custom instructions. Copilot creates a branch, implements following the charter's standards, and opens a PR.

**POs review and merge** — they are the human-in-the-loop. The PR is the acceptance gate.

### Execution Flow

```
Issue created → squad label → triage assigns PO
    ↓
PO reviews → applies go:yes + squad:{doer} label
    ↓
Workflow assigns Copilot as the doer (reads charter)
    ↓
Copilot implements → opens PR
    ↓
PO reviews PR → requests changes or approves → merge
```

**Cross-product work** requires agreement between affected POs. The doer who spans both products (De Paul for engine+launcher) coordinates implementation.

## GitHub Project & Issue Tracking

**Organization:** `deckio-art`
**Project:** GitHub Projects V2 board (org-level, covers all product repos)
**Repos with issues enabled:** `deck-engine`, `deck-launcher`, `deck-saas-core`

### Board Columns

| Column | When |
|--------|------|
| **Triage** | New issue, `squad` label applied, awaiting PO review |
| **Accepted** | PO applied `go:yes`, doer assigned |
| **In Progress** | Branch created or PR opened |
| **In Review** | PR ready for review |
| **Done** | PR merged, issue closed |
| **Blocked** | Cannot proceed — dependency, access, or decision needed |

### Issue Lifecycle

1. Issue created (via template or blank) → `squad` label applied
2. Triage workflow detects product → adds `product:*` + `squad:{po}` labels → PO notified
3. PO reviews → applies `go:yes` + `type:*` + `priority:*` + assigns doer via `squad:{doer}`
4. Doer picks up → moves to In Progress → opens PR
5. PR reviewed → merged → issue auto-closed → Done

### Install Workflows

Copy `.squad/github/` into each product repo's `.github/` directory:

```bash
# For each product repo (deck-engine, deck-launcher, deck-saas-core):
cp -r .squad/github/ISSUE_TEMPLATE <repo>/.github/ISSUE_TEMPLATE
cp -r .squad/github/workflows/sync-squad-labels.yml <repo>/.github/workflows/
cp -r .squad/github/workflows/squad-triage.yml <repo>/.github/workflows/
cp -r .squad/github/workflows/squad-label-enforce.yml <repo>/.github/workflows/
```

Then run the label sync workflow once per repo (`workflow_dispatch`) to seed labels.

## Communication

- **Async-first** — all work via GitHub Issues on the product repo
- **Labels** — `squad`, `squad:{agent}`, `product:*`, `go:*`, `type:*`, `priority:*`
- **Project board** — org-level GitHub Projects V2 board on `deckio-art`
- **Decisions** — logged in `.squad/decisions.md`
