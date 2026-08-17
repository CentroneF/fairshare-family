# Pull-request AI code review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Build the project’s first advisory AI code-review workflow for pull requests to `main`. It will turn the existing reviewer package into visible, repeatable PR feedback: six scored criteria, an actionable comment, and pass/fail labels without making AI output a merge gate.

## Starting Point

The reviewer already returns structured five-criterion output from a diff, while a starter workflow and composite action exist but cannot execute the package or publish a result. The established CI convention targets `main`; GitHub branch protection and deployment remain outside this change.

## Desired End State

Opened same-repository PRs receive one managed review comment and exactly one result label. Maintainers can rerun a review by adding `ai-cr:review`; the workflow updates the comment, switches the result label if needed, and removes the retry label. Fork PRs visibly skip review and never receive the API secret.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Target branch | `main` | Matches existing CI and repository default branch. | Plan |
| Review context | Title + non-empty body + diff | Gives the model intent without wasting tokens on empty descriptions. | Plan |
| Fork handling | Safe skip under `pull_request` | Prevents API-secret exposure; avoids `pull_request_target`. | Plan |
| Merge effect | Advisory | Model/API variance must not block valid merges. | Plan |
| Labels | Workflow-managed and idempotent | Removes manual setup and prevents contradictory state. | Plan |
| Runtime trust boundary | Base-SHA checkout + API-fetched diff | The PR cannot alter secret-bearing action code before it runs. | Research / Plan |

## Scope

**In scope:**

- Six-score reviewer request/output contract and package tests.
- Executable local composite action using the reviewer package.
- Opened-PR and label-retry workflow, comment, labels, permissions, concurrency, and fork guard.
- Static and live workflow verification plus operational documentation.

**Out of scope:**

- Required merge checks, branch protection, fork reviews, deployments, database CI, business alignment, and architectural-fit scoring.

## Architecture / Approach

GitHub Actions gathers trusted PR metadata and diff through GitHub APIs, checks out the base SHA, and calls the local composite action with a JSON request. The action runs the Node reviewer and returns its structured result. Workflow-side GitHub API logic then updates a marker-identified comment and manages `ai-cr:*` labels using the repository token.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reviewer contract | Six scores, PR metadata, deterministic package tests | Prompt/input safety and CLI transport |
| 2. Composite action | Runnable trusted adapter with structured output | No build artifact; credential isolation |
| 3. PR automation | Secure events, comment/label lifecycle, retry | Fork-secret and idempotency correctness |
| 4. Delivery verification | Documented, validated operational workflow | First live run occurs after workflow merge |

**Prerequisites:** Repository `OPENAI_API_KEY` secret; permission to run Actions and create PR labels/comments.  
**Estimated effort:** ~2–3 focused sessions across 4 phases.

## Open Risks & Assumptions

- The initial workflow PR cannot live-test itself because the trusted runtime is loaded from the base branch; a follow-up PR is required.
- Very large diffs may require a later size policy after observing actual model usage.
- GitHub branch protection stays external and must not be assumed to enforce the advisory result.

## Success Criteria (Summary)

- Same-repository PRs to `main` receive an updated six-score review comment and one matching result label.
- Adding `ai-cr:review` reruns idempotently; fork PRs safely skip.
- Root verification, reviewer tests/type checks, and static workflow validation pass; no deployment or required-check behavior changes.
