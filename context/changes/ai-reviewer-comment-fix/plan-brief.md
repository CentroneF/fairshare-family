# AI Reviewer Append-Only Comments — Plan Brief

> Full plan: `context/changes/ai-reviewer-comment-fix/plan.md`

## What & Why

The AI reviewer currently overwrites one marked pull-request comment whenever a new review finishes. This change makes feedback append-only: every completed qualifying review adds a new, visible comment, preserving the full review history on the PR.

## Starting Point

The publisher uses a hidden marker to find an earlier review comment and updates it in place. The workflow already runs for opened, reopened, synchronized, and retry-labelled same-repository PRs, with PR-level concurrency to prevent stale concurrent publications.

## Desired End State

A PR shows one immutable comment per completed AI review. Older review comments remain unchanged, while `ai-cr:passed` or `ai-cr:failed` continues to show only the latest advisory verdict. A failed comment publication leaves the retry label intact.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Coverage | Every qualifying workflow run | “Each review” includes opening, synchronization, and explicit retry reviews. |
| Comment identification | Remove the hidden marker | Comments are immutable history, not a resource to locate and replace. |
| Failure behavior | Stop before label cleanup | A failed publication must not consume a retry request or report a false latest result. |
| Regression coverage | Extend the existing static contract test | This directly guards the action APIs without a disproportionate publisher refactor. |

## Scope

**In scope:**

- Unconditional creation of visible AI review comments.
- Removal of marker, comment lookup, and update behavior.
- Contract-test and documentation updates.
- Preservation of current latest-verdict label and retry-label behavior.

**Out of scope:**

- Trigger, concurrency, security, review-model, scoring, or branch-protection changes.
- A publisher refactor or migration of existing PR comments.

## Architecture / Approach

The composite publisher will render its current Markdown and create a comment immediately. Only after that succeeds will it run the existing label lifecycle. This ordering provides the required all-or-nothing publication boundary for retries without adding new state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Publish Immutable Review History | Unconditional comment creation with preserved label ordering | A failure must stop before retry/result-label mutation. |
| 2. Lock the Contract and Update Maintainer Guidance | Regression protection and accurate operational docs | A future edit could silently restore an upsert path. |

**Prerequisites:** Existing GitHub Actions secret and labels for live verification.
**Estimated effort:** ~1 focused session across 2 vertical phases.

## Open Risks & Assumptions

- Comment volume grows with completed review runs by deliberate product decision.
- PR-level concurrency continues to cancel superseded active runs, so only completed runs add history.

## Success Criteria (Summary)

- Two completed reviews on one PR produce two separate, unchanged review comments.
- A successful retry creates another comment and updates only the current verdict label.
- Automated checks forbid marker-based comment lookup and update behavior.
