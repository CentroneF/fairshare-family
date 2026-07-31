# Responsive Dashboard Navigation — Plan Brief

> Full plan: `context/changes/add-burger-menu/plan.md`
> Frame brief: `context/changes/add-burger-menu/frame.md`

## What & Why

> **The actual problem to plan around is**: Reorganize secondary information on the established-family dashboard into one responsive navigation surface and make report history a dedicated, simple page, while preserving the primary expense workflow and setup flows.

Parents need the expense workspace to remain central while account and family information stop taking up the main page. Report history becomes easier to find through its own concise index page.

## Starting Point

The dashboard currently renders account information, sign out, family summary, expense workspace, and report history in one column. The expense workspace owns the server-side history read and replaces its history container after background mutations.

## Desired End State

Established-family parents see a sidebar at desktop size and a slide-in burger-menu drawer on smaller screens. These surfaces contain user information, the family description, sign out, and a link to Report history; the expense workspace stays in the main region.

The protected `/reports` page lists each past report’s month, settlement status, and approved total. Each item opens the existing selected-month dashboard report.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Responsive navigation | Sidebar on larger screens; slide-in drawer on smaller screens | Keeps secondary content available without crowding the primary workflow. | Frame |
| Drawer dismissal | Close control and backdrop click | Matches the confirmed interaction requirements. | Frame |
| Setup scope | No-family and awaiting-second-parent flows unchanged | Their family setup controls remain in their current location. | Frame |
| Sign out | Sidebar/drawer | Keeps account actions with logged-in-user information. | Plan |
| Report history | Dedicated `/reports` page | Removes report rows from dashboard navigation while keeping them discoverable. | Plan |
| Report rows | Month, status, approved total; link to dashboard month | Reuses the existing canonical report detail without duplication. | Plan |

## Scope

**In scope:** protected history route, existing history-loader reuse, report-list presentation, responsive established-family navigation, accessible drawer interaction, and workspace-refresh cleanup.

**Out of scope:** data/API changes, a new report-detail page, report exports/filtering/pagination, embedded navigation report list, setup-flow changes, and new E2E tooling.

## Architecture / Approach

`RLS-backed report-history loader → /reports server page → normal /dashboard?month=YYYY-MM links`. The dashboard branch for established families becomes `responsive navigation + expense workspace`; an Astro client script controls only the mobile drawer. Background workspace refresh continues to replace the balance and expense-list fragments, not report history.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dedicated history page | Protected report index with existing dashboard links | Wrong onboarding/family route handling |
| 2. Responsive navigation | Desktop sidebar and mobile drawer for established families | Drawer accessibility or unintended setup changes |
| 3. Refresh-boundary verification | Reliable background expense updates after history removal | Stale references to the removed history container |

**Prerequisites:** Existing report-history RPC and selected-month dashboard behavior.
**Estimated effort:** ~2–3 implementation sessions across 3 vertical phases.

## Open Risks & Assumptions

- The existing report-history loader and database policies remain the sole family-authorization boundary; this change does not duplicate the data source.
- No browser-test harness exists, so responsive and focus behavior requires explicit manual verification alongside build/lint/unit checks.
- A report list is fresh on each `/reports` request; the dashboard no longer needs to refresh report-history DOM after mutations.

## Success Criteria (Summary)

- Established-family parents can use the correct navigation presentation at both responsive sizes without disrupting expense work.
- Report history is a protected list with accurate month, status, and total data, and each item opens the existing detailed report.
- Background expense and settlement actions continue to refresh successfully after the dashboard history container is removed.
