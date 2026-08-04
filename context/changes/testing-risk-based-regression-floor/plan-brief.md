# Risk-Based Regression Floor — Plan Brief

> Full plan: `context/changes/testing-risk-based-regression-floor/plan.md`
> Research: `context/changes/testing-risk-based-regression-floor/research.md`

## What & Why

This change makes the existing financial and authorization regression suites
easy to run and automatically checks the fast JavaScript suite on pull requests
to `main`. It closes the gap between documented expectations and what CI
actually enforces, without adding costly or redundant test layers.

## Starting Point

Vitest and pgTAP suites already protect the relevant state and RLS boundaries.
The repository has only a manual CI workflow, which runs lint/build but omits
unit tests; pgTAP requires a local Docker-backed Supabase stack.

## Desired End State

Contributors run one fast `npm run verify` command locally, and pull requests
to `main` run that exact command after Astro preparation. Migration/RLS work
has an explicit local Supabase/pgTAP requirement, clearly separate from CI.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| CI event | Pull requests to `main` only | Adds PR feedback without unrequested push runs. | Plan |
| Fast gate | `npm run verify` | Prevents local/CI command drift. | Plan |
| DB gate | Required locally for migration/RLS work | It is authoritative but needs Docker/local Supabase. | Research |
| CI DB job | Excluded | No deterministic setup has been demonstrated. | Research |
| Branch protection | Excluded | It is external GitHub configuration. | Plan |

## Scope

**In scope:** aggregate npm command; existing workflow trigger and command;
README, CLAUDE, and test-plan corrections.

**Out of scope:** database CI, branch protection, hooks, browser/snapshot/AI
tests, and new financial or authorization test cases.

## Architecture / Approach

`package.json` owns the reusable fast verification sequence. The existing
workflow prepares the project with `npm ci` and Astro sync, then calls that
sequence for PRs to `main`. Documentation directs database-sensitive changes to
the separate real-Supabase pgTAP seam.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Deterministic JavaScript gate | Shared `npm run verify` command | Local/CI command drift |
| 2. PR enforcement | Existing workflow runs the command for PRs to `main` | Tests remain optional |
| 3. Published contract | Correct docs and cookbook | Contributors miss the DB prerequisite |

**Prerequisites:** Node 22 project dependencies; Docker/local Supabase only for
the database verification path.  
**Estimated effort:** one implementation session across three small phases.

## Open Risks & Assumptions

- A workflow trigger alone does not prove a required GitHub merge check.
- Database CI remains intentionally deferred until deterministic setup is
  demonstrated.

## Success Criteria (Summary)

- `npm run verify` succeeds and is the single fast JavaScript verification path.
- PRs to `main` run the existing workflow and execute that command.
- Documentation accurately distinguishes automatic CI from the local pgTAP gate.
