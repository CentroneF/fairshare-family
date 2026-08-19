# Expense refresh button — Plan Brief

> Full plan: `context/changes/expense-refresh-button/plan.md`
> Frame brief: `context/changes/expense-refresh-button/frame.md`

## What & Why

The expense refresh button currently prevents native form submission and then fails before starting its background fetch. The fix restores the background refresh path and adds unobtrusive feedback for refresh failures.

## Starting Point

The rendered form and workspace callback already exist. The failure is caused by a cross-script helper reference in Astro, while nearby components correctly resolve the global callback within their own scripts.

## Desired End State

Refresh updates the list without navigation and reports failures inline. The existing expense actions retain their current background workspace refresh behavior.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | Fix Refresh and audit nearby handlers | Prevents the same script-boundary error from surviving nearby. | User |
| Failure feedback | Non-invasive inline alert | Communicates failure without blocking the workspace. | User |
| Refresh behavior | Background request | Preserves scroll position and project convention. | Lessons |

## Scope

**In scope:** client handler consolidation, duplicate-registration protection, refresh feedback, and focused regression coverage.

**Out of scope:** API, database, or recurring-expense changes.

## Architecture / Approach

The list component will resolve the workspace refresh callback within the script that owns its event handler, then use a guarded delegated listener to handle dynamic workspace replacement safely.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Restore resilient expense refresh | Working background refresh and inline failures | Regressing other list actions |

**Prerequisites:** Local app and Supabase stack available for browser verification.
**Estimated effort:** One implementation session.

## Success Criteria (Summary)

- Refresh produces a background request and updates the workspace without navigation.
- Failed refreshes are visible but non-blocking.
- Existing expense actions keep working.
