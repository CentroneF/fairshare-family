---
date: 2026-08-17T13:31:08+02:00
researcher: Codex
git_commit: f1f6879141a5aa912b4c66f5bc4f1eb65bbebd0a
branch: main
repository: fairshare-family
topic: "First CI/CD workflow for pull-request AI code reviews"
tags: [research, github-actions, pull-requests, code-review, codex, ci-cd]
status: complete
last_updated: 2026-08-17
last_updated_by: Codex
---

# Research: First CI/CD workflow for pull-request AI code reviews

**Date**: 2026-08-17T13:31:08+02:00  
**Researcher**: Codex  
**Git Commit**: f1f6879141a5aa912b4c66f5bc4f1eb65bbebd0a  
**Branch**: main  
**Repository**: fairshare-family

## Research Question

Determine the repository integration points and constraints for the first GitHub Actions pull-request code-review workflow, using the supplied change requirements.

> The requirements are recorded in `context/changes/ci-cd-code-review/requirements.md`.

## Summary

The project already has the foundations for an AI review: a private Node/TypeScript reviewer produces validated JSON with five scored criteria, a pass/fail verdict, and a Markdown summary. It also has uncommitted starter files for a review workflow and a composite action. Those starter files do not yet run the package: they call a nonexistent action-local `dist/review.js`, install no dependencies, send no diff or PR metadata, and do not publish a comment or labels.

Planning should extend the existing PR-to-`main` CI convention rather than accept the requirements' `master` target without confirmation. It must explicitly decide how fork PRs are handled, since a `pull_request` workflow cannot receive the review API secret from forks. Do not switch to `pull_request_target` while checking out or executing PR code, because that would expose the secret to untrusted changes.

## Detailed Findings

### Requirements and branch scope

- The change requires a GitHub Actions review for new PRs, a composite action, PR title/body/diff inputs, six 1–10 criteria, a summary comment, mutually exclusive pass/fail labels, and retry when `ai-cr:review` is added (`context/changes/ci-cd-code-review/requirements.md:3-30`).
- The canonical detailed criteria are in `.agents/prompts/m5l3-requirements.md:16-38`; unlike the current package they include **documentation** as a sixth criterion.
- The requirements say `master`, but the committed CI workflow accepts PRs to `main` (`.github/workflows/ci.yml:3-5`) and the checked-out branch tracks `origin/main`. This branch conflict is an unresolved product/configuration decision, not something the workflow should silently guess.

### Existing GitHub Actions implementation

- The committed CI workflow establishes the runner convention: `ubuntu-latest`, `actions/checkout@v4`, Node 22 with npm cache, root and reviewer `npm ci`, Astro sync, then root `npm run verify` (`.github/workflows/ci.yml:7-22`).
- The uncommitted review workflow is deliberately small and uses a local composite action, but it targets `master`, runs on every PR activity plus manual dispatch, and provides only an API key (`.github/workflows/review.yml:1-16`). It does not respond specifically to the `ai-cr:review` label.
- The action declares only an `api-key` input and executes `${{ github.action_path }}/dist/review.js` (`.github/actions/ai-reviewer/action.yml:10-31`). No such build artifact exists, and the reviewer package has no build script (`packages/code-reviewer/package.json:6-20`).
- The action declares a verdict output but its invoked command does not write `GITHUB_OUTPUT`; the workflow currently does not consume it (`.github/actions/ai-reviewer/action.yml:17-20`).
- No review workflow/action currently declares permissions or performs GitHub API operations. Creating/updating a PR comment and applying/removing issue labels requires deliberate least-privilege permissions and idempotent behavior.

### Reviewer package contract

- The CLI reads its entire stdin as a diff, calls `review({ diff })`, prints JSON on stdout, and signals errors through stderr plus a nonzero exit (`packages/code-reviewer/src/cli.ts:5-25`). A workflow must obtain the PR diff and pipe it into this command.
- The public request type has only `diff` (`packages/code-reviewer/src/schemas/review.ts:19-21`), so title and description require an intentional API/prompt extension rather than merely new workflow inputs.
- The response already has 1–10 scores for implementation correctness, idiomaticity, complexity, test/risk coverage, and security/safety; it also contains the required `verdict` and Markdown `summary` (`packages/code-reviewer/src/schemas/review.ts:3-13`). Documentation is missing.
- The prompt treats the diff as data and rejects embedded instructions, which is the appropriate baseline for untrusted PR content (`packages/code-reviewer/src/prompts/code-review.ts:3-10`). PR title/body must receive equivalent data delimiting and instruction-isolation treatment.
- The package provides `check`, `dev`, and `start`, but no automated tests (`packages/code-reviewer/package.json:6-20`). Root CI installs it but does not run `npm run check` (`.github/workflows/ci.yml:16-19`).

### Authentication and security boundaries

- The reviewer documentation identifies `OPENAI_API_KEY` as the API-key environment variable and `CODEX_MODEL` as optional model configuration (`packages/code-reviewer/README.md:5-8`, `:16-18`). The uncommitted action instead maps its input to `CODEX_API_KEY` (`.github/actions/ai-reviewer/action.yml:26-31`), an integration mismatch that must be resolved in one documented contract.
- GitHub does not expose ordinary repository secrets to fork-originated `pull_request` runs. The plan needs an explicit safe outcome for those PRs: for example, skip with a clear status/comment where allowed, or restrict automated review to trusted same-repository PRs. It must not run a secret-bearing review against checked-out fork code through `pull_request_target`.
- The reviewer runs the Codex SDK in a read-only sandbox and asks approval only where policy requires it (`packages/code-reviewer/src/agent/code-reviewer.ts:23-63`). Its isolation limits local modifications, but it does not remove the need to protect the API key and treat PR input as untrusted.

### Repository conventions and historical context

- `npm run verify` is the committed fast gate: Vitest, ESLint, then production build (`package.json:5-14`). Repository instructions require that gate before PRs and separately require database tests after migrations/RLS changes (`AGENTS.md:20-24`).
- The prior regression-floor research concluded that CI should reuse the existing deterministic JavaScript gate, leave database testing explicit unless a stable Docker setup is proven, and treat branch protection as external configuration (`context/changes/testing-risk-based-regression-floor/research.md:105-131`).
- The deployment plan reserves production deployment for Cloudflare Builds, so this change should remain review automation only (`context/changes/deployment/deployment-plan.md:5-44`).
- Current review workflow/action files and this change directory are untracked, and `packages/code-reviewer/.env.example` is modified. They are treated as in-flight user work; this research did not alter them.

## Code References

- `.github/workflows/ci.yml:3-22` — established pull-request CI target and Node installation pattern.
- `.github/workflows/review.yml:1-16` — unfinished review-workflow trigger and composite-action call.
- `.github/actions/ai-reviewer/action.yml:10-31` — incomplete composite action interface and nonexistent runtime path.
- `packages/code-reviewer/src/cli.ts:5-25` — stdin-to-JSON CLI boundary.
- `packages/code-reviewer/src/schemas/review.ts:3-21` — current review schema and input limit.
- `packages/code-reviewer/src/prompts/code-review.ts:3-10` — review prompt and diff data boundary.
- `context/changes/ci-cd-code-review/requirements.md:3-30` — supplied functional requirements.

## Architecture Insights

The clean boundary is: a thin workflow gathers event metadata and a base-to-head diff; the composite action owns installing/running the reviewer and exposes structured results; workflow-side GitHub API steps render the result into an idempotent PR comment and mutually exclusive labels. This keeps the main workflow readable while leaving reviewer logic testable as a local package.

The reviewer’s contract should be expanded once to accept a structured PR-review request (title, optional body, diff) and return six explicit criterion scores. Do not encode scoring or comment formatting ambiguously in shell parsing; preserve JSON as the hand-off format and add tests around the prompt/schema boundary.

## Historical Context

- `context/changes/testing-risk-based-regression-floor/research.md` records the existing CI contract and the decision to keep the expensive database gate outside generic CI unless proven deterministic.
- `context/changes/testing-risk-based-regression-floor/plan.md:101-121` recommends extending existing CI conventions rather than adding unrelated pipeline behavior.
- `context/changes/deployment/deployment-plan.md` separates Cloudflare deployment from GitHub Actions validation; no deployment scope belongs in this change.

## Related Research

- `context/changes/testing-risk-based-regression-floor/research.md` — CI quality-gate constraints.
- `context/changes/testing-expense-settlement-state-protections/research.md` — testing boundaries and verification conventions.

## Open Questions

1. Should review target the repository-standard `main` branch or the requirements' `master` branch?
2. Is PR body inclusion worth the token/cost increase, and should an empty body be omitted rather than passed as empty input?
3. What safe, visible behavior is required for fork-originated PRs that cannot access the API secret?
4. Should the workflow create labels if absent, or should `ai-cr:review`, `ai-cr:passed`, and `ai-cr:failed` be provisioned as repository configuration?
5. What score/verdict policy determines `pass` versus `fail`, and should a failed AI review be a required merge check or advisory feedback only? Branch protection remains an external setting.
