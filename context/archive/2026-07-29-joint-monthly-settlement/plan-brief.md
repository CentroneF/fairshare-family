# Joint Monthly Settlement — Plan Brief

> Full plan: `context/changes/joint-monthly-settlement/plan.md`

## What & Why

Both parents need to jointly finalize a completed past month, so neither can unilaterally lock a financial report. This change adds two-step confirmation, a permanent report lock, and a stored final settlement snapshot while preserving the app’s exact amount rules.

## Starting Point

The app already derives exact monthly balances, supports expense review/correction, and shows a binary Settled/Unsettled history label. The database already has two confirmation fields on `monthly_settlements`, but no settlement command or dashboard interaction exists; create/approve/decline also need the same lock protocol as correction actions.

## Desired End State

For an eligible past report, either parent can confirm the calculated payment or no-payment result. That first confirmation freezes all report changes; the distinct second parent settles the report, writes an exact final snapshot, and the dashboard/history update in the background. Ineligible reports still show a disabled action with a clear reason.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| First confirmation | Visible and irreversible | It signals agreement and freezes the exact report until the other parent confirms. |
| Mutation policy | Block every expense mutation after first confirmation | Neither parent can change what the other is being asked to confirm. |
| Finalization | Second distinct parent settles | Preserves the PRD’s equal-authority requirement. |
| Financial record | Full exact snapshot at final settlement | Keeps an explicit final record of totals, contributions, and payment outcome. |
| Zero payment | Still settle jointly | A completed equal-balance report deserves an explicit final status. |
| History | Binary Settled/Unsettled | Partial progress stays in the selected report, keeping history compact. |
| Interaction | Inline card plus native confirmation dialog | Shows the exact outcome beside the balance and prevents accidental confirmation. |
| Ineligible state | Disabled control with visible and tooltip guidance | Makes settlement discoverable while explaining what must change. |
| Verification | Unit + pgTAP + full UI manual flow | Financial locks and RLS require authoritative database proof plus real UX validation. |

## Scope

**In scope:** settlement RPC and snapshot migration, shared family locking across all expense mutations, confirmation endpoint, dashboard state/card/dialog, background history refresh, exact unit tests, pgTAP authorization/locking tests, and manual two-parent verification.

**Out of scope:** confirmation withdrawal, settlement reversal, notifications, money transfer, a third history state, audit history, recurring expenses, and custom split rules.

## Architecture / Approach

`selected report → server-derived settlement state → inline dialog → authenticated route → SECURITY DEFINER settlement RPC`. The RPC locks the family, re-checks eligibility against database rows, records confirmation, and writes the immutable snapshot only after the second parent confirms. Every expense command takes that same family lock and rejects first-confirmed or settled report months.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Confirm and lock | Complete two-parent happy path, snapshot, and shared lock | Concurrency gap between confirmation and expense mutation |
| 2. Explain state | Ineligible guidance, locked/settled details, live history refresh | Confusing disabled or stale UI state |
| 3. Prove boundary | Lifecycle, RLS, stale-attempt, and responsive-flow regression proof | Future change weakening the financial authority boundary |

**Prerequisites:** Completed expense correction and report-history work; local Supabase stack for pgTAP.
**Estimated effort:** ~3–4 sessions across 3 end-to-end phases.

## Open Risks & Assumptions

- First confirmation is deliberately irreversible; an error requires the parents to complete settlement rather than reopen the report.
- Existing settled rows have no snapshot. The migration must preserve them and distinguish legacy records safely.
- The local database must be migrated incrementally; `supabase db reset` would remove local test users.

## Success Criteria (Summary)

- Two distinct parents can settle only an eligible past all-approved report, including zero-payment reports.
- First confirmation and final settlement prevent every expense mutation at both UI and database boundaries.
- The settled report retains exact final totals/contributions/payment information, and UI updates without a full-page refresh.
