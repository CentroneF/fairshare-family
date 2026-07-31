# Frame Brief: Responsive dashboard navigation

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Information about the logged-in user, the family description, and access to
past reports are displayed in the dashboard page flow.

## Initial Framing (preserved)

- **User's stated cause or approach**: Some items on the screen should be placed in a burger menu instead of on the page.
- **User's proposed direction**: Use a burger menu on smaller screens and a sidebar on bigger screens; the small-screen menu slides in.
- **Pre-dispatch narrowing**: Keep the expense workflow on the main page; reorganize secondary account and family information responsively, and expose report history through its own page.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Dashboard composition** — account, family, and report surfaces are rendered in the main dashboard flow.
2. **Responsive layout behavior** — existing breakpoints reflow content but do not change navigation presentation.  ← initial framing
3. **Report-history interaction** — report selection and background refresh rely on the current history container.
4. **Accessible overlay behavior** — a slide-in menu requires new, explicit interaction behavior.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Dashboard composition needs restructuring | Account/sign-out are rendered in `src/pages/dashboard.astro:38-50`; family panels render at `:72-98`; reports are rendered by `src/components/expenses/ExpenseWorkspace.astro:83-85`. | STRONG |
| Responsive navigation behavior already exists | Existing `sm` and `md` rules only reflow the header and onboarding grid in `src/pages/dashboard.astro:36-40,54,63`; no sidebar, burger menu, or drawer exists. | STRONG |
| History can remain a page-flow-only concern | Report links live in `src/components/expenses/MonthlyReportHistory.astro:18-66`, and workspace refresh replaces its container in `ExpenseWorkspace.astro:88-105`. | NONE |
| Existing drawer behavior can be reused | The project has modal/focus patterns but no side-anchored drawer or responsive navigation component. | STRONG |

## Narrowing Signals

- The small-screen navigation must be a slide-in drawer.
- On larger screens, the same secondary content must be visible in a sidebar.
- First-time and awaiting-second-parent setup screens stay unchanged; their invite and child-management controls remain in place.
- Navigation provides a link to a dedicated report-history page; the page starts as a simple clickable list with month, settlement status, and approved total.
- The drawer closes through its close button or when the user taps its backdrop.

## Cross-System Convention

The project uses mobile-first Tailwind breakpoints and has accessible modal-dialog patterns, but no reusable drawer. The new navigation is a new responsive UI behavior, not a configuration of an existing component.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Reorganize secondary information on the established-family dashboard into one responsive navigation surface and make report history a dedicated, simple page, while preserving the primary expense workflow and setup flows.

The initial framing was correct. The existing page already has the required data and interactions; the work is to change the dashboard layout and expose its report data through a separate index page.

## Confidence

- **HIGH** — source inspection confirms the current placement, and both independent investigations agree that responsive navigation is absent.

## What Changes for /10x-plan

Plan a responsive dashboard navigation surface containing logged-in-user information, family description, sign out, and a report-history link: a persistent sidebar on larger screens and a slide-in drawer opened from a burger button on smaller screens. Add a protected report-history page that lists months, settlement statuses, and approved totals, with each row opening the existing selected-month dashboard report. Preserve unchanged setup screens and close the drawer through its close button or backdrop.

## References

- Source files: `src/pages/dashboard.astro:35-102`; `src/components/family/FamilySummaryPanel.astro:10-27`; `src/components/expenses/ExpenseWorkspace.astro:83-105`; `src/components/expenses/MonthlyReportHistory.astro:18-66`
- Investigation tasks: dashboard composition; responsive accessibility
