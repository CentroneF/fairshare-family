# Monthly Report History — Plan Brief

> Full plan: `context/changes/monthly-report-history/plan.md`

## What & Why

Parents need a discoverable way to revisit earlier shared-expense reports and know whether each month is settled. This plan adds a compact report-history index that leads into the existing dashboard report rather than creating a parallel reporting experience.

## Starting Point

The dashboard already renders a selected current or past month, with exact derived amounts and a family-scoped settlement record. It lacks a chronological list of previous reports and shows no settlement state to the user.

## Desired End State

Parents can expand History on the dashboard, scan prior meaningful months in newest-first order, see a clear Settled/Unsettled badge and approved PLN total, and open any row in the established selected-month view. A family with no prior reports sees a helpful empty state.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Included months | Prior expense or settlement months | Avoids an empty calendar while retaining settlement-only history. |
| Row content | Month, status, approved total | Gives compact report context without duplicated detail UI. |
| Navigation | Existing dashboard month URL | Preserves one canonical detailed report and normal GET fallback. |
| Presentation | Collapsible dashboard section | Keeps the dashboard compact while making history discoverable. |
| Freshness | Update on next navigation | Avoids expanding the existing background fragment-refresh contract. |
| Data model | Derived reads only | Keeps exact totals authoritative and avoids cached aggregates. |

## Scope

**In scope:** family-scoped history read model, exact approved-total summaries, settlement-status badges, collapsible responsive dashboard UI, empty state, and unit/database access tests.

**Out of scope:** settlement actions, report snapshots, dedicated reports route, all-empty-month calendar, exports, pagination, and immediate history refresh after mutations.

## Architecture / Approach

`RLS-protected expenses + monthly_settlements → server-side grouped history read model → MonthlyReportHistory Astro component → /dashboard?month=YYYY-MM`. The existing selected-month workspace remains responsible for detailed expenses and balance.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Read model | Exact, prior-month family history data | Wrong status or amount grouping |
| 2. Dashboard history | Collapsible rows, badges, and existing-month navigation | Duplicated report interaction or weak mobile layout |
| 3. Boundaries | RLS and multi-month regression proof | Family-data exposure or settlement semantic drift |

**Prerequisites:** S-02 approved-expense balance; existing settlement schema and RLS.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- History is intentionally static between dashboard navigations; the selected report still refreshes after background mutations.
- The MVP expects modest expense history; it avoids stored aggregates and N+1 per-month balance loads.
- Future S-05 must update settlement state through the existing table so history reflects it dynamically.

## Success Criteria (Summary)

- Prior meaningful months are discoverable, newest first, with exact approved totals and explicit state.
- Selecting a row always opens the existing family-scoped selected-month report.
- Automated tests preserve exact amounts, family-only source visibility, and no direct settlement mutation.
