# Current-month named contribution split — Plan Brief

> Full plan: `context/changes/current-month-summary-improvements/plan.md`

## What & Why

The dashboard will show each parent's live approved contribution in the current month's Monthly balance card. This makes the active report explain the current split directly, rather than only showing aggregate totals and who owes whom.

## Starting Point

The balance calculation already produces exact per-parent approved contributions, but the dashboard does not render them or carry both parents' display names into the balance card. Settled historical reports use separate immutable contribution snapshots and are outside this change.

## Desired End State

Each parent sees both display names and exact approved contribution amounts in the current-month card, including a `0.00 PLN` contribution. Pending items remain in To review, declined items stay excluded, and background refreshes update the split with the other balance values.

## Key Decisions Made

| Decision           | Choice                                  | Why (1 sentence)                                                                                        |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Contributor labels | Both display names                      | Names are clearer than anonymous amounts or viewer-relative labels.                                     |
| Contribution basis | Approved expenses only                  | This preserves the existing financial rules and prevents provisional amounts from being shown as final. |
| Placement          | Existing Monthly balance card           | It keeps totals, contributions, and balance guidance together.                                          |
| Scope              | Current month only                      | The request targets the dashboard; historical snapshot behavior remains stable.                         |
| Zero values        | Show both parents, including `0.00 PLN` | The split stays explicit even if one parent has not yet contributed.                                    |

## Scope

**In scope:**

- Read active parent display names with existing membership data.
- Display exact approved contributions for both parents on the current-month dashboard.
- Cover financial, state, display-boundary, and refresh regressions.

**Out of scope:**

- Migrations, RPC changes, or changes to balance calculations.
- Pending/declined contribution breakdowns.
- Any visual or behavioral change to historical reports or current-month settlement controls.

## Architecture / Approach

The server-side workspace read model carries two active parent records (membership ID plus display name). The shared balance card uses those IDs to look up the already-derived Decimal contributions, but receives an explicit current-month guard from its workspace so the new live section cannot appear in historical report routes.

## Phases at a Glance

| Phase                        | What it delivers                                            | Key risk                                                                |
| ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Named Current-Month Split | Named live contributions, tests, and dashboard verification | Accidentally exposing the live section in a historical shared workspace |

**Prerequisites:** Existing two-parent family with display names and approved current-month expenses.
**Estimated effort:** ~1 focused implementation session.

## Open Risks & Assumptions

- A historical workspace shares the balance component, so the explicit current-month guard is essential.
- Display names should exist for established two-parent families; an unexpected missing value needs a safe fallback rather than a failed render.

## Success Criteria (Summary)

- The current dashboard shows both names and exact approved contributions, including zero values.
- Pending and declined expenses do not inflate either contribution.
- Background refreshes update the split, and past reports do not render it.
