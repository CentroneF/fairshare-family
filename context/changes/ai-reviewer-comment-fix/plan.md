# AI Reviewer Append-Only Comments Implementation Plan

## Overview

Change the AI-review publisher from a marker-based upsert to append-only publication. Every completed, qualifying review run will add a new visible pull-request comment, leaving all prior AI review comments intact.

## Current State Analysis

The publish composite action embeds a hidden `<!-- ai-code-review -->` marker, lists PR comments, and updates the first marked comment it finds. That design intentionally overwrites historical feedback. The workflow invokes this action for same-repository PRs on `opened`, `reopened`, `synchronize`, and `ai-cr:review` label retries; it already cancels superseded concurrent runs per PR.

The label lifecycle follows comment publication: it applies the latest pass/fail label, removes the opposite label, then removes a retry label when applicable. Therefore a comment-publication failure currently prevents those later writes, which is the required failure behavior and must remain intact.

## Desired End State

Each completed qualifying AI review publishes a distinct, visible PR comment containing that run's scores, verdict, and summary. Existing review comments are never searched, marked, or edited. The PR still displays only the latest advisory result label, and a retry label remains in place if publication fails.

### Key Discoveries:

- `.github/actions/publish-ai-review/action.yml:34-52` performs the marker-based list/find/update-or-create path that overwrites comments.
- `.github/workflows/ai-code-review.yml:3-24,40-47` defines qualifying events, same-repository guard, PR-level concurrency, and invokes the publisher for every completed review.
- `packages/code-reviewer/src/workflow/review-workflow.test.ts:23-44` asserts the old idempotent update contract using static source checks.
- `packages/code-reviewer/README.md:61-71` tells maintainers that retries refresh an existing marked comment.

## What We're NOT Doing

- Changing which PR events trigger an AI review, fork safeguards, concurrency, review scoring, or model execution.
- Preserving a hidden marker or providing a new API for locating historical review comments.
- Changing label names, colors, latest-verdict label exclusivity, branch protection, or deployment configuration.
- Refactoring the GitHub Script publisher out of the composite action solely to add mocked API tests.

## Implementation Approach

Make the publisher construct its current visible Markdown body and call GitHub's comment-creation endpoint unconditionally. Remove all marker, comment-listing, comment-selection, and update behavior. Retain the existing order so comment creation succeeds before labels mutate, then update the focused workflow-contract test and operational language to describe append-only history.

## Critical Implementation Details

Comment creation must remain before any label mutation. If GitHub rejects the new comment, the action must stop before applying result labels or removing `ai-cr:review`, so a retry request is not silently consumed without visible feedback.

## Phase 1: Publish Immutable Review History

### Overview

Replace the single managed-comment upsert with an unconditional visible comment creation, while preserving current label and retry failure semantics.

### Changes Required:

#### 1. Advisory feedback publisher

**File**: `.github/actions/publish-ai-review/action.yml`

**Intent**: Publish one standalone review comment for every completed qualifying review so prior feedback is retained as history.

**Contract**: Build the existing score, verdict, and summary Markdown without `<!-- ai-code-review -->`; call `github.rest.issues.createComment` exactly once for the PR without querying or updating existing comments. Keep comment creation before `addLabels`, opposite-label removal, and retry-label removal; those label operations retain their existing behavior.

### Success Criteria:

#### Automated Verification:

- `npm test --prefix packages/code-reviewer` passes after the publisher behavior changes.
- Action source contains one unconditional `issues.createComment` publishing path and contains no review marker, `issues.listComments`, or `issues.updateComment` usage.

#### Manual Verification:

- Trigger two completed same-repository reviews for one PR and confirm two separate visible AI review comments exist, with the earlier comment unchanged.
- Add `ai-cr:review` and confirm a successful retry adds a new comment, updates only the latest verdict label, and removes the retry label.
- Force or observe a comment-publication failure and confirm `ai-cr:review` remains while no later label mutations occur.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation that live PR comment history and retry behavior are correct before proceeding.

---

## Phase 2: Lock the Contract and Update Maintainer Guidance

### Overview

Prevent a reintroduction of comment overwriting and align action/package documentation with append-only review history.

### Changes Required:

#### 1. Workflow publication contract test

**File**: `packages/code-reviewer/src/workflow/review-workflow.test.ts`

**Intent**: Make the existing static workflow-contract suite detect a return to the marker-based upsert design.

**Contract**: Rename the idempotent-feedback assertion to describe append-only feedback; require `issues.createComment`, and assert the publisher source does not contain `<!-- ai-code-review -->`, `issues.listComments`, or `issues.updateComment`. Continue asserting the trusted checkout, model/request handling, and label lifecycle contracts.

#### 2. Publisher and package documentation

**Files**: `.github/actions/publish-ai-review/action.yml`, `packages/code-reviewer/README.md`

**Intent**: Give maintainers accurate operational expectations for new review comments and retries.

**Contract**: The action description no longer claims it uses one marked PR comment. The README states that every completed qualifying review, including a successful retry, adds a new review comment; it does not claim historical comments are refreshed or replaced.

### Success Criteria:

#### Automated Verification:

- `npm test --prefix packages/code-reviewer` passes with append-only publisher assertions.
- `npm run check --prefix packages/code-reviewer` passes.

#### Manual Verification:

- Read the action description and GitHub Actions setup section and confirm they explain that review comments are historical records while labels reflect only the latest result.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation that the documented behavior matches a live PR review.

## Testing Strategy

### Unit Tests:

- Extend `review-workflow.test.ts` static contract checks to require comment creation and reject marker, lookup, and update APIs.
- Preserve existing assertions for the same-repository guard, qualifying trigger types, trusted base checkout, reviewer request construction, and pass/fail label behavior.

### Integration Tests:

- A live same-repository PR smoke test runs the workflow twice and verifies two distinct review comments with unchanged content in the first comment.
- A retry-label run verifies it appends another comment, preserves result-label exclusivity, and removes `ai-cr:review` only after publication.

### Manual Testing Steps:

1. Open or synchronize a same-repository PR targeting `main` and record the first AI review comment.
2. Trigger another qualifying review and verify a second comment appears without edits to the first.
3. Apply `ai-cr:review` and verify the retry adds a third comment, retains only the latest verdict label, and removes the retry label after publication.
4. Confirm the action/package documentation describes this append-only history accurately.

## Performance Considerations

Removing the comment-list request eliminates one GitHub API call per review and avoids comment-list pagination. Comment volume will grow with completed review runs by design; PR concurrency continues to prevent superseded in-progress runs from publishing.

## Migration Notes

No migration is required. Existing marked comments remain untouched as historical PR data; reviews published after deployment omit the marker and always create a new comment. Rolling back restores the old publisher behavior only for future runs and does not alter comments already created.

## References

- Existing review workflow: `.github/workflows/ai-code-review.yml:3-47`
- Publisher action: `.github/actions/publish-ai-review/action.yml:1-63`
- Workflow contract test: `packages/code-reviewer/src/workflow/review-workflow.test.ts:12-45`
- Maintainer setup: `packages/code-reviewer/README.md:59-78`
- Superseded original behavior: `context/changes/ci-cd-code-review/plan.md:209-228`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Publish Immutable Review History

#### Automated

- [x] 1.1 Pass reviewer-package tests after append-only publication changes — ea2ed31
- [x] 1.2 Prove the publisher creates comments without marker, lookup, or update APIs — ea2ed31

#### Manual

- [x] 1.3 Confirm repeated and retry-triggered reviews create distinct unchanged historical comments — ea2ed31
- [x] 1.4 Confirm a publication failure retains the retry label and prevents later label mutations — ea2ed31

### Phase 2: Lock the Contract and Update Maintainer Guidance

#### Automated

- [x] 2.1 Pass reviewer-package tests with append-only workflow-contract assertions — ea2ed31
- [x] 2.2 Pass reviewer-package TypeScript checking — ea2ed31

#### Manual

- [x] 2.3 Confirm action and README guidance describe append-only comments and latest-result labels — ea2ed31
