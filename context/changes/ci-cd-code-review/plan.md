# Pull-request AI code review implementation plan

## Overview

Deliver an advisory GitHub Actions review for newly opened pull requests to `main` and trusted, label-triggered retries. The workflow will submit the pull request title, optional description, and base-to-head diff to the local reviewer; it will update one marked PR comment and maintain one pass/fail label without blocking merges.

## Current State Analysis

The repository has a Node/TypeScript `packages/code-reviewer` package that accepts only a diff and returns five scored criteria plus a verdict and summary. An uncommitted workflow and composite action establish the desired layout, but the action calls a nonexistent build artifact, does not install dependencies or collect PR context, and does not publish the result.

Existing CI runs against pull requests to `main`, while the requirements mention `master`. The settled scope targets `main`. The review continues to use the safe `pull_request` event and skips fork-originated PRs because secrets are unavailable there; it will not use `pull_request_target`.

## Desired End State

For an opened same-repository PR to `main`, GitHub Actions obtains title, non-empty body, and base-to-head diff without executing checked-out PR code. It invokes the reviewer, posts or updates a single actionable summary comment with all six scores, applies exactly one of `ai-cr:passed` or `ai-cr:failed`, and succeeds regardless of the model verdict.

Adding `ai-cr:review` reruns the advisory review and refreshes the same comment and result label, then removes the retry label. Fork-originated PRs visibly skip the review job and never receive the model credential. Reviewer/process failures remain failed workflow runs, distinct from an advisory model `fail` verdict.

### Key Discoveries:

- Root CI already targets `main` and establishes Node 22 plus locked npm installation (`.github/workflows/ci.yml:3-22`).
- `ReviewRequest` currently has only `diff`, and its schema lacks the required documentation score (`packages/code-reviewer/src/schemas/review.ts:5-21`).
- The current local action runs a nonexistent `dist/review.js` and only accepts the API key (`.github/actions/ai-reviewer/action.yml:10-31`).
- The reviewer runner accepts an injected client, providing a deterministic unit-test seam without calling Codex (`packages/code-reviewer/src/agent/contracts.ts:9-21`, `packages/code-reviewer/src/agent/code-reviewer.ts:23-63`).

## What We're NOT Doing

- Making AI review a required merge check or changing GitHub branch-protection settings.
- Reviewing fork-originated PRs, or using `pull_request_target` to gain their secrets.
- Adding business-alignment or architectural-fit scoring.
- Adding deployment, database-test CI, or modifying the existing root CI quality gate.
- Building a GitHub App, storing review history, or adding a reviewer dashboard.

## Implementation Approach

Keep GitHub event orchestration thin and move reviewer behavior into the existing package. The workflow will run only on `opened` and qualifying `labeled` events for `main`, with a concurrency key per PR. A job-level guard skips forks and unrelated labels. It uses the GitHub API to retrieve the PR diff and metadata, checks out the trusted base SHA to load the local composite action and reviewer code, and passes a structured request file to the action.

The composite action installs and type-checks the package, runs its CLI, and exposes the validated JSON result. Workflow-side GitHub API code owns the idempotent PR comment and label lifecycle. A stable hidden marker identifies the one managed comment; labels are created on demand with the required colors, the opposite verdict is removed, and the retry label is removed only after a successful retry publication.

## Critical Implementation Details

The review runtime must come from the PR base SHA, not the untrusted head SHA. Obtain the PR diff through the GitHub API and load the composite action from the base checkout; this means the initial PR that introduces the workflow is verified after merge, while later PRs cannot alter secret-bearing action code before it runs.

Treat all title, body, and diff text as untrusted data. Serialize request metadata as JSON rather than shell interpolation, omit an empty body, and delimit each input section in the reviewer prompt while retaining the existing instruction-isolation rule.

Use the canonical score anchors from `.agents/prompts/m5l3-requirements.md` consistently in the reviewer prompt, generated JSON schema, and package documentation. Each score is an integer from 1 through 10; the anchors below define the ends of the scale, not a substitute for reviewer judgment between them.

| Criterion | Grade 1 | Grade 10 |
| --- | --- | --- |
| Implementation correctness | Logic is broken, misses obvious edge/error cases, or silently regresses existing behavior. | Works across happy paths, edge cases, and failure modes without regressions. |
| Idiomaticity | Fights the stack and repository patterns; reads as foreign. | Matches well-written surrounding code and uses the right idioms naturally. |
| Complexity | Is over-engineered or tangled, with accidental complexity that obscures intent. | Is the minimal, clear design that completely solves the problem. |
| Test/risk coverage | Risky logic is untested, or tests are absent, trivial, or unhelpful. | Tests the paths most likely to break deliberately and in proportion to risk. |
| Documentation | Leaves needed intent opaque, forcing readers to reverse-engineer it. | Explains the why behind non-obvious decisions without restating the obvious. |
| Security/safety | Introduces an exploitable flaw, leaks secrets, or unsafely trusts untrusted input. | Validates input, handles secrets correctly, and opens no new attack surface. |

## Phase 1: Extend the reviewer contract and regression coverage

### Overview

Make the reviewer capable of evaluating a complete PR context and returning the six criteria required by the change, with deterministic tests for schema validation, prompt composition, agent validation, and CLI input/output behavior.

### Changes Required:

#### 1. Review data schema and prompt

**Files**: `packages/code-reviewer/src/schemas/review.ts`, `packages/code-reviewer/src/prompts/code-review.ts`

**Intent**: Represent a PR review as title, optional non-empty body, and diff; add documentation as a required 1–10 score alongside the existing criteria.

**Contract**: `ReviewRequest` requires `title` and `diff` and permits an omitted `body`; `Review` and its generated JSON schema require `documentation`. The prompt uses separate data delimiters for title, optional body, and diff, states all six criteria, and preserves prompt-injection resistance for every input.

#### 2. Reviewer API and CLI request boundary

**Files**: `packages/code-reviewer/src/cli.ts`, `packages/code-reviewer/src/index.ts`, `packages/code-reviewer/README.md`, `packages/code-reviewer/.env.example`

**Intent**: Preserve a reusable library API while giving CI a robust structured-input path that does not corrupt multiline PR metadata.

**Contract**: The CLI consumes one JSON review-request file (or an equivalent explicitly documented structured input) and emits the validated review JSON on stdout; invalid/missing required request fields fail nonzero and diagnostics remain on stderr. The package documentation and sample environment use the single selected API-key variable, `OPENAI_API_KEY`, plus optional `CODEX_MODEL`.

#### 3. Package test runner and deterministic reviewer tests

**Files**: `packages/code-reviewer/package.json`, `packages/code-reviewer/package-lock.json`, `packages/code-reviewer/src/schemas/review.test.ts`, `packages/code-reviewer/src/prompts/code-review.test.ts`, `packages/code-reviewer/src/agent/code-reviewer.test.ts`, `packages/code-reviewer/src/cli.test.ts`

**Intent**: Make the package independently verifiable without a real model call.

**Contract**: Add a package-local test command and test dependency. Cover score boundaries and missing documentation, prompt inclusion/omission and data delimiting, injected-runner validation of a six-score response, and CLI structured input including absent title and optional body behavior.

### Success Criteria:

#### Automated Verification:

- `npm run check --prefix packages/code-reviewer` passes.
- `npm test --prefix packages/code-reviewer` passes without Codex credentials or network access.
- Tests prove that all six scores are required and bounded 1–10, and that hostile title/body/diff text remains data rather than instructions.

#### Manual Verification:

- Running the documented CLI locally with a valid structured PR request prints six scores, verdict, and Markdown summary; an empty PR body is absent from the prompt/request.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the local CLI behavior is correct before proceeding.

---

## Phase 2: Make the composite action execute and expose reviews

### Overview

Turn the local composite action into the trusted runtime adapter: install the reviewer package, enforce its type check, invoke it with a structured request, and expose its result to the workflow without lossy shell parsing.

### Changes Required:

#### 1. Composite action interface and runtime

**File**: `.github/actions/ai-reviewer/action.yml`

**Intent**: Replace the nonexistent action-local build artifact with the checked-out reviewer package and define an explicit request/result hand-off.

**Contract**: Inputs include the structured request-file path and the review API key; the action maps that key only to `OPENAI_API_KEY`, installs locked reviewer dependencies, runs the package type check, invokes the CLI, and returns the raw result-file path (and/or validated JSON) plus verdict through `GITHUB_OUTPUT`. It must not print the credential or depend on a `dist/` artifact.

#### 2. Action runtime documentation

**Files**: `.github/actions/ai-reviewer/action.yml`, `packages/code-reviewer/README.md`

**Intent**: Keep the action and package invocation contract discoverable and aligned for local debugging.

**Contract**: Documentation identifies the request format, supported environment variables, stdout/result semantics, and the fact that a model `fail` is a valid review result rather than an action error.

### Success Criteria:

#### Automated Verification:

- Static workflow/action validation accepts the composite-action YAML and its declared inputs/outputs.
- The action’s package setup path runs `npm ci`, `npm run check`, and the CLI against a fixture request without requiring a committed `dist/` directory.
- The action exposes a six-score review result and verdict through the documented output contract.

#### Manual Verification:

- In an Actions run with a test credential, a successful model `pass` and `fail` both complete the action successfully; a malformed request or model execution error fails the action clearly.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the action’s results and failure modes are understandable before proceeding.

---

## Phase 3: Calibrate the six-score rubric

### Overview

Give the reviewer and PR authors an unambiguous shared meaning for the bottom and top of every score before automated feedback is delivered.

### Changes Required:

#### 1. Criterion-specific score anchors

**Files**: `packages/code-reviewer/src/prompts/code-review.ts`, `packages/code-reviewer/src/schemas/review.ts`, `packages/code-reviewer/README.md`

**Intent**: Replace the generic "serious gaps" / "exemplary" instruction with the six canonical criterion-specific 1 and 10 anchors above.

**Contract**: The reviewer prompt explicitly gives the meaning of grade 1 and grade 10 for all six criteria. The generated response JSON schema carries the same criterion-specific guidance, and the package README documents the rubric for maintainers. The anchors remain descriptive; `pass`/`fail` is still a separate advisory model verdict.

#### 2. Deterministic rubric regression tests

**Files**: `packages/code-reviewer/src/prompts/code-review.test.ts`, `packages/code-reviewer/src/schemas/review.test.ts`

**Intent**: Prevent future edits from silently reducing the agent's scoring guidance to criterion names or a generic scale.

**Contract**: Tests assert that the constructed model prompt and generated response JSON schema include a grade-1 and grade-10 anchor for every criterion. They run without Codex credentials or network access.

### Success Criteria:

#### Automated Verification:

- `npm run check --prefix packages/code-reviewer` passes.
- `npm test --prefix packages/code-reviewer` passes without Codex credentials or network access.
- Tests prove that all six criterion-specific grade-1 and grade-10 anchors reach the reviewer prompt and response schema.

#### Manual Verification:

- Inspect a generated fixture prompt and confirm each criterion has an understandable grade 1 and grade 10 definition, while PR title/body/diff remain untrusted data.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the rubric is understandable before proceeding.

---

## Phase 4: Deliver secure advisory PR review automation

### Overview

Wire the trusted composite action into a secure, idempotent PR workflow that reviews opened PRs and label retries, then publishes advisory feedback through one comment and controlled labels.

### Changes Required:

#### 1. Event, permissions, and trusted execution boundary

**File**: `.github/workflows/review.yml`

**Intent**: Align triggers with the repository’s `main` branch, support the requested retry label, avoid stale concurrent runs, and keep secrets out of fork PRs.

**Contract**: Use `pull_request` for `opened` and `labeled` activity against `main`; run only opened events or `labeled` events whose label is `ai-cr:review`; guard the review job to same-repository PRs; and key concurrency by PR number with in-progress cancellation. Declare only `contents: read`, `pull-requests: read`, and `issues: write` permissions. The job is advisory: model verdicts do not fail it, but unexpected retrieval/action failures do.

#### 2. Metadata and diff preparation

**File**: `.github/workflows/review.yml`

**Intent**: Give the reviewer complete PR context without checking out or executing untrusted head code.

**Contract**: Retrieve title/body and the base-to-head diff through GitHub APIs; serialize a request JSON in runner temporary storage; omit empty body; and check out the PR base SHA before invoking the local composite action. Never place untrusted metadata in a shell command via interpolation.

#### 3. Idempotent feedback and label lifecycle

**File**: `.github/workflows/review.yml`

**Intent**: Make each review easy to find and safe to rerun without accumulating stale comments or contradictory labels.

**Contract**: Workflow-side GitHub API logic creates missing `ai-cr:review`, `ai-cr:passed` (green), and `ai-cr:failed` (red) labels; finds a stable hidden-marker comment and updates it or creates it once; renders six scores, verdict, and summary; applies the matching result label; removes the opposite result label; and removes `ai-cr:review` after a successful retry. It uses `GITHUB_TOKEN` for GitHub writes and does not expose `OPENAI_API_KEY` outside the composite action.

### Success Criteria:

#### Automated Verification:

- Static validation confirms the workflow event filter, job guard, concurrency, permissions, and composite-action interface.
- Workflow-oriented tests or fixtures cover opened PR, qualifying retry label, unrelated label, same-repository PR, and fork PR guard behavior.
- Publishing logic tests cover initial comment creation, marked-comment update, result-label replacement, retry-label removal, and no job failure for an AI `fail` verdict.

#### Manual Verification:

- Open a same-repository PR to `main`: it produces one advisory review comment and exactly one result label.
- Add `ai-cr:review`: it refreshes the existing comment, updates the result label, and removes the retry label without creating a second comment.
- Open a fork PR: the review job visibly skips and no API credential is available to it.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that live GitHub feedback, retries, and fork handling work as specified before proceeding.

---

## Phase 5: Verify delivery and document operational setup

### Overview

Run the project and package gates, validate the workflow configuration, and document the minimal repository setup so the review remains advisory and operable after merge.

### Changes Required:

#### 1. Workflow and package verification integration

**Files**: `.github/workflows/review.yml`, `packages/code-reviewer/README.md`, `context/changes/ci-cd-code-review/requirements.md`

**Intent**: Make the supported validation commands and necessary GitHub configuration clear without broadening the CI/deployment scope.

**Contract**: Document the required `OPENAI_API_KEY` secret and the three managed labels, the advisory (non-branch-protection) behavior, the fork skip policy, and local package/root verification commands. Keep the workflow self-sufficient for labels while documenting the expected colors and retry behavior.

### Success Criteria:

#### Automated Verification:

- `npm run verify` passes.
- `npm run check --prefix packages/code-reviewer` and `npm test --prefix packages/code-reviewer` pass.
- Static workflow/action validation passes on the final YAML.

#### Manual Verification:

- A maintainer can follow the documentation to configure the secret, observe advisory feedback on a same-repository PR, retry with the label, and understand the expected fork skip.
- GitHub branch-protection configuration remains unchanged and no deployment workflow was added or modified.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the operational documentation matches the deployed workflow.

## Testing Strategy

### Unit Tests:

- Schema score bounds, required documentation score, and JSON-schema generation.
- Criterion-specific grade-1 and grade-10 anchors in the reviewer prompt and response schema.
- Prompt sections for title, optional body, and diff, including instruction-like untrusted content.
- Reviewer validation through the injected runner seam, including missing/invalid six-score responses.
- CLI structured-request success and validation failures without real Codex credentials.
- Comment marker, score rendering, and label-transition helpers if they are extracted from workflow API code into testable JavaScript.

### Integration Tests:

- Static YAML/action validation for events, guards, permissions, and declared input/output contracts.
- A GitHub Actions run on a same-repository fixture PR covering initial publication and retry idempotency.
- A fork-originated fixture PR confirming the job is skipped and cannot access the review API key.

### Manual Testing Steps:

1. Configure `OPENAI_API_KEY` in the repository and open a same-repository PR to `main`.
2. Confirm one marked comment shows the six scores, verdict, and summary, with one matching result label.
3. Add `ai-cr:review` and confirm the existing comment changes rather than duplicates, the result labels remain exclusive, and retry label disappears.
4. Verify a fork PR shows the intended skipped review job and does not execute the action.

## Performance Considerations

One model request is made per opened/retry review. The workflow includes PR-level concurrency cancellation so only the newest run can publish feedback; description omission when empty avoids unnecessary prompt tokens. Diff-size limits and chunking are deliberately out of scope until real PR-size telemetry shows a need.

## Migration Notes

The first workflow PR cannot exercise the new workflow from the base branch because it does not yet exist there; validate it statically before merge, then use a follow-up same-repository PR for the first live run. No data migration or database change is required. Removing the review workflow and local action is a safe rollback; comments and labels can remain as historical advisory evidence.

## References

- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Research: `context/changes/ci-cd-code-review/research.md`
- Existing CI: `.github/workflows/ci.yml:3-22`
- Current reviewer contract: `packages/code-reviewer/src/schemas/review.ts:3-21`
- Reviewer runner seam: `packages/code-reviewer/src/agent/code-reviewer.ts:23-66`
- Existing action scaffold: `.github/actions/ai-reviewer/action.yml:10-31`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extend the reviewer contract and regression coverage

#### Automated

- [x] 1.1 Pass package type checking — 4175abf
- [x] 1.2 Pass deterministic package tests for six-score PR review requests — 4175abf
- [x] 1.3 Prove input data isolation and optional-body behavior in tests — 4175abf

#### Manual

- [x] 1.4 Confirm documented local CLI review output — 4175abf

### Phase 2: Make the composite action execute and expose reviews

#### Automated

- [x] 2.1 Pass static composite-action validation — 17fa7a3
- [x] 2.2 Run the action against a structured request without a dist artifact — 17fa7a3
- [x] 2.3 Expose a validated six-score result through the action contract — 17fa7a3

#### Manual

- [x] 2.4 Confirm action success for advisory pass/fail and clear failure for execution errors — 17fa7a3

### Phase 3: Calibrate the six-score rubric

#### Automated

- [x] 3.1 Pass package type checking with criterion-specific score anchors — 71e1b56
- [x] 3.2 Pass deterministic prompt and schema tests for all grade-1 and grade-10 anchors — 71e1b56

#### Manual

- [x] 3.3 Confirm the rubric is understandable in a generated reviewer prompt — 71e1b56

### Phase 4: Deliver secure advisory PR review automation

#### Automated

- [x] 4.1 Validate workflow triggers, guards, concurrency, permissions, and action interface
- [x] 4.2 Cover event qualification and fork skipping with workflow fixtures or tests
- [x] 4.3 Cover idempotent comment and label lifecycle with workflow fixtures or tests

#### Manual

- [x] 4.4 Confirm same-repository PR review publication and label exclusivity
- [x] 4.5 Confirm retry refreshes one comment and removes the retry label
- [x] 4.6 Confirm fork PR skips without access to the review credential

### Phase 5: Verify delivery and document operational setup

#### Automated

- [ ] 5.1 Pass root and reviewer verification commands
- [ ] 5.2 Pass final static workflow/action validation

#### Manual

- [ ] 5.3 Confirm repository setup documentation and advisory behavior
- [ ] 5.4 Confirm no branch-protection or deployment scope change
