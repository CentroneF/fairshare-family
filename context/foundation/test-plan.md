# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-08-04

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the risk wins. Do not promote to e2e because it feels safer, or add an AI layer over deterministic protection.
2. **User concerns are first-class evidence.** The team's lived migration, RLS, settlement, and expense-state concerns carry the same weight as documented requirements.
3. **Risks are scenarios, not code locations.** This plan documents what could fail and why it is likely. It does not claim which line owns the failure; `/10x-research` establishes that per rollout phase.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`.

## 2. Risk Map

The Source column cites evidence that surfaced each risk, never a code anchor.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Expense creation, review, editing, or deletion succeeds after a month is frozen. | High | High | PRD FR-007–009, FR-014; interview Q1/Q4; hot-spot dir `src/components/` (73 changes/30d) |
| 2 | One parent permanently settles a report alone, or the report changes after the first confirmation. | High | High | PRD success criteria and guardrails; roadmap S-05; interview Q1; hot-spot dir `src/lib/` (45 changes/30d) |
| 3 | A migration or RLS change exposes another family's data/actions, or blocks legitimate family access. | High | High | PRD access control; interview Q2/Q3; hot-spot dirs `supabase/migrations/` (13 changes/30d), `supabase/tests/` (16 changes/30d) |
| 4 | Editing or deleting a pending, approved, or declined expense changes a balance incorrectly or skips required re-review. | High | High | PRD FR-007–008; roadmap S-03; interview Q4; hot-spot dirs `src/lib/` and `src/components/` |
| 5 | Approved, pending, or declined expenses are included in the wrong monthly total or settlement decision. | High | Medium | PRD US-01 and financial-accuracy guardrail; roadmap S-02 and S-05; archived financial-rules slice |
| 6 | An authenticated parent bypasses family ownership constraints to read or mutate another family's resources. | High | Medium | PRD family-only access requirement; interview Q2/Q3; hot-spot migration and test directories |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | A frozen month rejects every prohibited mutation without side effects. | A disabled UI control enforces the server rule. | Mutation boundary, settlement state, lock/order guarantee, side effects. | database integration | Happy-path-only mutation tests. |
| #2 | First confirmation freezes the report; only a distinct second parent can finalize it. | A successful response means the report is safely immutable. | Confirmation identity, persisted state, concurrency behavior. | database integration | Brittle ordering assumptions. |
| #3 | Own-family access works while cross-family reads and mutations fail after migration changes. | Authentication alone proves ownership. | RLS execution context, migration contracts, RPC/direct-write boundary. | database integration | Mocked authorization internals. |
| #4 | Each eligible edit/delete transition preserves totals and requires re-review where applicable. | Current status labels fully encode financial effects. | State transitions, persisted totals, reviewer rules, month constraints. | unit + database integration | Assertions copied from production logic. |
| #5 | Monthly totals and eligibility include only the required expense states with exact amounts. | A final balance alone proves intermediate state handling. | State inputs, exact-amount oracle, settlement eligibility contract. | unit | Implementation-mirror calculations. |
| #6 | A signed-in parent cannot act on another family's resources. | A route-level session check is enough. | Resource ownership path, request identity, RLS/RPC boundary. | database integration | Testing only same-family happy paths. |

## 3. Phased Rollout

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Expense and settlement state protections | Prove financial state transitions and settlement locking reject invalid changes. | #1, #2, #4, #5 | unit + database integration | not started | — |
| 2 | Family authorization and migration boundaries | Prove RLS and migration changes preserve family isolation and valid access. | #3, #6 | database integration | not started | — |
| 3 | Risk-based regression floor | Make the shipped patterns runnable and align required local and CI gates. | cross-cutting | test commands + quality gates | not started | — |

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | Vitest | 4.1.10 | Sparse suite: four library tests; `npm test` runs Vitest. |
| database integration | Supabase CLI / pgTAP | 2.109.1 | Existing SQL tests; run after local Supabase starts. |
| e2e | none | — | Not planned until research shows an integration layer cannot provide the signal. |
| AI-native | none | — | Do not use when deterministic unit or database integration tests catch the risk. |

**Stack grounding tools (current session):**
- Docs: none — no dedicated docs MCP available; checked: 2026-08-04.
- Search: web search — checked official Vitest and Astro testing guidance; checked: 2026-08-04.
- Runtime/browser: browser tool — available but not used; reconsider only for DOM-unreachable critical behavior; checked: 2026-08-04.
- Provider/platform: none — no provider MCP available; checked: 2026-08-04.

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint | local + CI | required | syntax and static-rule drift |
| build/type validation | local + CI | required | Astro and TypeScript integration drift |
| unit + database integration | local + CI | required after §3 Phase 3 | financial, state, and authorization regressions |
| pre-prod smoke | manual | optional | environment-specific migration/access failures |

## 6. Cookbook Patterns

### 6.1 Financial and state-transition tests

- TBD — see §3 Phase 1 for the settled-month mutation and exact-total patterns.

### 6.2 RLS and migration-boundary tests

- TBD — see §3 Phase 2 for family-isolation and migration-regression patterns.

### 6.3 Running the risk-based suite

- TBD — see §3 Phase 3 for exact local and CI commands.

## 7. What We Deliberately Don't Test

- **Low-impact presentation-only styling** — it has low blast radius and weak signal for this product. Re-evaluate if it becomes a critical accessibility or transactional interaction surface. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-08-04
- Stack versions last verified: 2026-08-04
- AI-native tool references last verified: 2026-08-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes,
- §7 negative-space no longer matches what the team believes.
