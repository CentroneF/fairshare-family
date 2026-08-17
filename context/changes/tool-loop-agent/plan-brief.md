# Modular Codex Code-Review Agent — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`

## What & Why

The code-reviewer package will become a reusable, buffered Codex SDK agent instead of two duplicated CLI scripts. Its new public API will expose the review contract, prompt builder, schemas, typed failures, and configurable reviewer so future Promptfoo evaluations can call it directly—without adding any Promptfoo or evaluation configuration now.

## Starting Point

The package has no `src/index.ts`; `src/review.ts` and `src/review-streamed.ts` each mix prompt/schema definitions, Codex execution, response parsing, dotenv, stdin, and console output. The streamed path is explicitly being removed, while the standard buffered CLI remains.

## Desired End State

Consumers can safely import `src/index.ts` without starting Codex or reading stdin, then invoke a buffered reviewer with a serializable diff input. The standard `git diff | npm run start` command still produces valid JSON, but it delegates to that reusable API and the old streamed command no longer exists.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Public API | Factory plus convenience review function | Supports configured application use while keeping simple evaluation calls ergonomic. |
| Score validation | Strict 1–10 integers | Makes the output contract match the prompt and catches malformed model results. |
| Execution mode | Buffered only | Removes the duplicate streamed CLI and keeps the future agent base focused. |
| Test/eval seam | Narrow injectable runner/client | Enables future fixture-driven evaluations without binding callers to the Codex CLI. |
| Environment access | `process.env.CODEX_MODEL` default | Preserves existing model configuration while allowing explicit caller overrides. |
| Errors | `CodeReviewError` | Gives library consumers a predictable failure boundary. |
| Eval tooling | Deferred | Keeps Promptfoo and evaluation environment configuration out of scope. |

## Scope

**In scope:**

- A side-effect-free `src/index.ts` export surface.
- Separate prompt, schema, error, and buffered agent modules.
- Strict structured review validation and typed errors.
- One retained buffered CLI with updated documentation and environment example.
- Removal of `review-streamed.ts` and `start-streamed`.

**Out of scope:**

- Promptfoo installation, configuration, or evaluation suites.
- A test framework or test suite.
- Streaming execution support.
- Package publishing or database/application changes.

## Architecture / Approach

Pure modules define the review input/output contract and prompt. A buffered agent factory uses an injected narrow execution seam, adapting the Codex SDK only in its production default. `index.ts` exports that library layer, while the CLI wrapper alone loads dotenv, consumes stdin, and writes JSON output.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure contracts | Strict schemas, prompt builder, types, typed errors | Accidentally changing the review output contract. |
| 2. Buffered agent API | Injectable reusable reviewer and public index exports | Leaking CLI side effects into imports. |
| 3. CLI migration | Buffered wrapper, removed streamed path, aligned docs | Breaking stdin/stdout compatibility. |
| 4. Boundary verification | Clean-install, package-content, CLI and import checks | Documentation drifting from executable behavior. |

**Prerequisites:** Local Codex CLI authentication for the real CLI smoke check; Node.js 18+.
**Estimated effort:** ~2–3 sessions across 4 independently verifiable phases.

## Open Risks & Assumptions

- Enterprise policy requires `approvalPolicy: "on-request"`; the production default must not reintroduce `"never"`.
- `CODEX_MODEL` must be compatible with the caller’s Codex account; leaving it unset uses the CLI default.
- This plan relies on fixture-based manual checks until a separate testing/evaluation change is approved.

## Success Criteria (Summary)

- The public API is importable without dotenv, stdin, logging, or Codex execution side effects.
- A stubbed runner can validate reusable success and typed failure paths without credentials.
- `git diff | npm run start` remains a working buffered JSON review command, and no streamed command remains.
