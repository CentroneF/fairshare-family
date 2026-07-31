# Expense Date Picker Boundaries — Plan Brief

> Full plan: `context/changes/date-picker-fix/plan.md`
> Frame brief: `context/changes/date-picker-fix/frame.md`

## What & Why

Create and edit expense flows must both enforce the displayed report month in their UI and server validation; an expense must not be moved between months. The existing create picker established that experience; the revised plan extends it to editing.

## Starting Point

Creation already uses the shared fixed-month `ExpenseDatePicker.astro` and server validation. Editing still uses a native date input and an API route that accepts a valid non-future date from another month.

## Desired End State

Users edit an expense with the same fixed-month calendar used to create it. The edit HTTP endpoint rejects altered cross-month values, while valid saves retain the current background-refresh behavior.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Edit interaction | Reuse shared picker | Ensures exact selected-month and no-navigation behavior. | Plan |
| Server guard | HTTP API only | Protects browser and HTTP clients without altering the established RPC. | Plan |
| Existing data | No audit or rewrite | The user confirmed cross-month legacy records should not exist. | Plan |

## Scope

**In scope:** edit picker, edit HTTP validation, shared validation tests, and create/edit regression verification.

**Out of scope:** database-RPC changes, direct-RPC enforcement, data repair, and new test frameworks.

## Architecture / Approach

The edit dialog passes its displayed month, maximum eligible date, and existing expense date to the shared picker. The edit route applies the same `validateExpenseDateInMonth` helper as create before calling the existing update service.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Selected-Month Calendar Integration | Fixed-month creation calendar | Completed |
| 2. Fixed-Month Edit Enforcement and Regression Verification | Fixed-month edit UI and API boundary | API-only guard does not constrain direct RPC callers |

**Prerequisites:** Phase 1 is complete; no migration is required.
**Estimated effort:** One implementation session plus manual verification.

## Open Risks & Assumptions

- Direct callers of `update_expense` can still move dates across months by explicit scope decision.
- Existing cross-month expense records are assumed absent.

## Success Criteria (Summary)

- Create and edit calendars expose only the displayed report month and disable current-month future days.
- A tampered cross-month edit fails safely at the HTTP API.
- Unit tests, lint, build, and manual background-success checks pass.
