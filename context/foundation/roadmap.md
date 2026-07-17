---
project: FairShare Family
version: 1
status: draft
created: 2026-07-17
updated: 2026-07-17
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: FairShare Family

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The “At a glance” table is the index.

## Vision recap

FairShare Family gives separated or divorced co-parents a shared record of child expenses so they can understand monthly spending without relying on a spreadsheet. Its first release focuses on recording, reviewing, and agreeing the balance to exchange while preserving financial accuracy and equal authority between parents.

## North star

**S-02: An approved expense changes the shared monthly balance** — this is the earliest end-to-end proof that both parents can turn a shared record into an agreed financial view.

> Here, the north star means the smallest complete user flow that proves the product’s central promise; it is placed early because later work only matters if this shared-expense flow works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | financial-rules-verification | (foundation) verify exact financial rules before shared balances depend on them | — | Business Logic; Non-Functional Requirements — financial accuracy | blocked |
| S-01 | family-onboarding | create an account, establish a family, add children, and join as the second parent | — | FR-001, FR-002, FR-003, FR-004, FR-005; Non-Functional Requirements — responsive Android-installable web experience | ready |
| S-02 | approved-expense-balance | add, review, and see an approved expense affect the selected month’s balance | S-01, F-01 | US-01, FR-006, FR-009, FR-011, FR-013 | blocked |
| S-03 | unsettled-expense-corrections | correct or remove their own unsettled expense without corrupting the shared balance | S-02, F-01 | FR-007, FR-008 | proposed |
| S-04 | monthly-report-history | browse previous monthly reports and distinguish settled from unsettled months | S-02 | FR-012 | proposed |
| S-05 | joint-monthly-settlement | jointly settle and lock an eligible monthly report | S-03, S-04, F-01 | FR-014 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Family entry | `S-01` | Establishes the two-parent workspace that feeds the shared-expense flow. |
| B | Shared financial agreement | `F-01` → `S-02` → `S-03` / `S-04` → `S-05` | Joins Stream A at `S-02`; keeps the fastest financially safe path in focus. |

## Baseline

What’s already in place in the codebase as of `2026-07-17` (auto-researched + user-confirmed). Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro routes and React components provide the existing web interface.
- **Backend / API:** partial — server handlers cover authentication, but no family, expense, or report capabilities are wired.
- **Data:** absent — Supabase is configured, but application persistence, schema, and queries are not present.
- **Auth:** present — email/password sign-in, cookie sessions, and protected dashboard access are wired.
- **Deploy / infra:** present — Cloudflare Worker configuration and CI/deployment workflow are in place.
- **Observability:** partial — Worker observability is enabled, but application-level logging, error tracking, and alerts are absent.

## Foundations

### F-01: Financial-rules verification

- **Outcome:** (foundation) exact amount handling, fixed 50/50 balance rules, and settlement eligibility have a shared verification path before user-facing balances rely on them.
- **Change ID:** financial-rules-verification
- **PRD refs:** Business Logic; Non-Functional Requirements — exact amounts and final rounding
- **Unlocks:** S-02, S-03, S-05
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:**
  - Which currency or currencies does the MVP support? — Owner: user. Block: yes.
- **Risk:** Financial rules are the product’s trust boundary; resolving currency first prevents a fast path from encoding the wrong amount semantics.
- **Status:** blocked

## Slices

### S-01: Family onboarding

- **Outcome:** user can create an account, sign in, create a family, add children, and share a join code so the second parent can enter the same family.
- **Change ID:** family-onboarding
- **PRD refs:** FR-001, FR-002, FR-003, FR-004, FR-005; Non-Functional Requirements — authenticated family-only access and responsive Android-installable web experience
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This reuses the existing account access rather than expanding it; the scope stays focused on a usable two-parent starting point.
- **Status:** ready

### S-02: Approved expense changes the shared monthly balance

- **Outcome:** user can add an expense, the other parent can approve or decline it, and an approved expense appears in the selected month’s list and balance while a declined expense remains visible but excluded.
- **Change ID:** approved-expense-balance
- **PRD refs:** US-01, FR-006, FR-009, FR-011, FR-013
- **Prerequisites:** S-01, F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which currency or currencies does the MVP support? — Owner: user. Block: yes.
- **Risk:** This is the first complete shared-money flow; it must separate approved and pending values clearly so provisional spending is not presented as final.
- **Status:** blocked

### S-03: Unsettled expense corrections

- **Outcome:** user can edit an unsettled expense for re-review or delete their own unapproved unsettled expense without changing a locked month.
- **Change ID:** unsettled-expense-corrections
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** S-02, F-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - Which currency or currencies does the MVP support? — Owner: user. Block: no.
- **Risk:** Correction rules change shared totals, so they follow the first review flow instead of adding alternate state changes before it is proven.
- **Status:** proposed

### S-04: Monthly report history

- **Outcome:** user can browse previous monthly reports and clearly see whether each month is settled or unsettled.
- **Change ID:** monthly-report-history
- **PRD refs:** FR-012
- **Prerequisites:** S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** History is sequenced after the current-month flow so it extends a real report rather than creating a second, disconnected view.
- **Status:** proposed

### S-05: Joint monthly settlement

- **Outcome:** user can jointly settle and lock a past month only after all expenses are approved and no declined or pending expenses remain.
- **Change ID:** joint-monthly-settlement
- **PRD refs:** FR-014
- **Prerequisites:** S-03, S-04, F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which currency or currencies does the MVP support? — Owner: user. Block: no.
- **Risk:** Settlement is intentionally last because it makes prior data irreversible and depends on the complete correction and report rules.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | financial-rules-verification | Verify financial calculation and settlement rules | no | Currency decision blocks planning. |
| S-01 | family-onboarding | Let two co-parents establish a shared family workspace | yes | Reuses existing account access. |
| S-02 | approved-expense-balance | Let co-parents approve expenses into the monthly balance | no | Depends on S-01 and the blocked financial-rules foundation. |
| S-03 | unsettled-expense-corrections | Let a parent correct an unsettled expense safely | no | Depends on S-02. |
| S-04 | monthly-report-history | Let a parent browse monthly report history | no | Depends on S-02. |
| S-05 | joint-monthly-settlement | Let both parents settle an eligible monthly report | no | Depends on S-03 and S-04. |

## Open Roadmap Questions

1. **What transaction-volume ballpark should the live product support?** — Owner: user. Block: roadmap-wide no.
2. **What expense-data volume should the live product support?** — Owner: user. Block: roadmap-wide no.
3. **Which currency or currencies does the MVP support?** — Owner: user. Block: F-01, S-02, S-03, S-05.

## Parked

- **Recurring monthly expenses (FR-010).** — Why parked: it is nice-to-have, and the speed-first MVP needs the one-off approval and balance path first.
- **Expense notifications.** — Why parked: PRD Non-Goals excludes them from the MVP.
- **In-app expense disputes and comments.** — Why parked: PRD Non-Goals excludes both from the MVP.
- **Custom split ratios, more than two co-parents, or multiple families per account.** — Why parked: PRD Non-Goals fixes the MVP to one family with two equal co-parents.
- **In-app money transfer and native mobile applications.** — Why parked: PRD Non-Goals limits the product to calculating settlement and an Android-installable web experience.

## Done

