# Modular Codex Code-Review Agent Implementation Plan

## Overview

Refactor the standalone code-reviewer CLI into a reusable, buffered Codex SDK agent with a public library API. The refactor removes duplicated prompt/schema/execution logic, preserves the existing safe CLI defaults, and exposes a serializable review contract that future Promptfoo evaluations can call without configuring an evaluation environment now.

## Current State Analysis

`packages/code-reviewer/src/index.ts` does not exist. The two existing entry points duplicate the system prompt, review schema, Codex client/thread setup, JSON parsing, and CLI orchestration. Both files mix import-time side effects (`dotenv/config`), stdin reading, console I/O, and agent behavior, which prevents safe library imports.

The package currently supports a buffered path in `review.ts` and a verbose streamed path in `review-streamed.ts`. Its organization requires `approvalPolicy: "on-request"` and the agent uses a read-only sandbox. `CODEX_MODEL` is optional, but the package documentation and environment example currently name different API-key variables.

## Desired End State

`packages/code-reviewer/src/index.ts` is a side-effect-free public entry point that exports a configurable review-agent factory, a convenience review function, the review input/output contracts, prompt builder, schemas, and typed errors. A caller can invoke the agent with a diff and an injected narrow SDK runner/client seam; CLI-only concerns stay in a thin `review.ts` adapter.

The package retains one buffered `npm run start` command that accepts a diff on stdin and returns only pretty-printed review JSON on stdout. Promptfoo is not installed or configured, but a future evaluation can import the public contract and run a fixture diff through the reusable API.

### Key Discoveries:

- `packages/code-reviewer/src/review.ts:1-63` combines dotenv loading, the review contract, Codex execution, validation, stdin, and stdout in one file.
- `packages/code-reviewer/src/review-streamed.ts:1-94` duplicates the same workflow and adds event logging; it will be removed rather than preserved as another execution mode.
- `packages/code-reviewer/package.json:5-20` has no library entry point or tests; `npm run check` is the package’s current automated verification command.
- `@openai/codex-sdk` supports buffered `Thread.run()` and an injected execution seam can avoid spawning the real CLI in future tests or evaluations.
- `context/foundation/lessons.md:10-13` requires phases to be independently verifiable; every phase below has its own automated and manual checks.

## What We're NOT Doing

- Installing Promptfoo, adding Promptfoo configuration, or creating an evaluation environment.
- Keeping `review-streamed.ts`, `start-streamed`, or a streamed public agent API.
- Changing the five review criteria, verdict semantics, or summary format beyond enforcing their documented score range.
- Publishing this private package or adding build/distribution metadata for external npm consumers.
- Changing Codex authentication policy, sandbox mode, or enterprise-managed approval requirements.

## Implementation Approach

Build the package library-first. Pure prompt and schema modules define the stable evaluation contract; a buffered agent module owns Codex configuration, execution, and parsing; `index.ts` re-exports only the intended public surface. The remaining CLI is a thin adapter that loads environment variables, reads stdin, invokes the library, writes its result to stdout, and reports operational progress/errors on stderr.

The factory accepts a narrow runner/client dependency rather than binding callers to the concrete Codex class. The production default adapts the Codex SDK, while future tests and Promptfoo code can provide deterministic fixture behavior. Library defaults read `process.env.CODEX_MODEL`; dotenv loading remains a CLI concern so imports do not mutate process state.

## Critical Implementation Details

Keep `sandboxMode: "read-only"` and `approvalPolicy: "on-request"` in the production default. The latter matches the enterprise-managed requirement that rejected the previous `"never"` setting. Treat the supplied diff as data when constructing the prompt, and keep all library modules free of stdin, stdout/stderr, and dotenv side effects.

## Phase 1: Extract Pure Review Contracts

### Overview

Create side-effect-free modules for the structured output contract, prompt construction, and error representation so the later agent and future evaluators share one source of truth.

### Changes Required:

#### 1. Review schemas and types

**Files**: `packages/code-reviewer/src/schemas/review.ts`

**Intent**: Move the review Zod schema and derived result types out of CLI code. Enforce each score as an integer from 1 through 10, matching the documented review contract rather than relying only on prompt wording.

**Contract**: Export the review schema, its JSON Schema for Codex structured output, the serializable review result type, and the review-request input type containing a diff.

#### 2. Review prompt module

**Files**: `packages/code-reviewer/src/prompts/code-review.ts`

**Intent**: Centralize the reviewer system instructions and diff-to-prompt construction so CLI and future eval callers cannot drift.

**Contract**: Export the immutable system prompt and a pure prompt-builder function that accepts the review input and clearly delimits the diff as review data.

#### 3. Typed review failure

**Files**: `packages/code-reviewer/src/errors/code-review-error.ts`

**Intent**: Replace generic parsing and turn-failure errors with an error callers can identify and handle consistently.

**Contract**: Export `CodeReviewError` with a stable message and preserved underlying cause/context for malformed JSON, invalid structured output, missing final output, and execution failures.

### Success Criteria:

#### Automated Verification:

- `npm run check` succeeds with the new pure modules included by TypeScript.
- The schema’s exported TypeScript type represents the intended pass/fail verdict and required score fields.

#### Manual Verification:

- Import the prompt builder and schema in a one-off `tsx` command; a valid fixture parses and an out-of-range or non-integer score is rejected.
- Inspect a generated prompt to confirm the complete supplied diff is present inside the chosen delimiters.

**Implementation Note**: After automated verification passes, manually confirm the fixture behavior before proceeding to Phase 2.

---

## Phase 2: Create the Reusable Buffered Agent API

### Overview

Build a side-effect-free buffered agent around the extracted contracts, with a narrow injectable execution seam and a stable public `index.ts` facade.

### Changes Required:

#### 1. Agent execution contracts and implementation

**Files**: `packages/code-reviewer/src/agent/contracts.ts`, `packages/code-reviewer/src/agent/code-reviewer.ts`

**Intent**: Isolate Codex SDK interaction from application callers and make deterministic fixture execution possible later without adding an eval framework now.

**Contract**: Define the minimal runner/thread capabilities needed for a buffered structured-output request. Export a configurable `createCodeReviewer(options)` factory whose returned reviewer accepts a review input and resolves to the validated review result; support an explicit injected runner/client and explicit model override, with `process.env.CODEX_MODEL` as the default model source.

#### 2. Public package facade

**Files**: `packages/code-reviewer/src/index.ts`

**Intent**: Create the requested reusable entry point and make the public imports discoverable without executing dotenv, stdin, or console code.

**Contract**: Re-export the factory, a default convenience review function, public input/output types, review schema and JSON Schema, prompt builder, and `CodeReviewError`. Do not execute a review or read process input at import time.

### Success Criteria:

#### Automated Verification:

- `npm run check` succeeds with the agent interfaces and `index.ts` public exports.
- The public entry point can be type-checked from a consumer-style import without importing either CLI adapter.

#### Manual Verification:

- Invoke the public factory with a stubbed runner/client that returns a valid structured response and confirm it resolves to a `Review` object without Codex credentials.
- Exercise malformed JSON and schema-invalid fixture responses through the public API and confirm callers receive `CodeReviewError`.

**Implementation Note**: After automated verification passes, manually validate stubbed success and failure behavior before proceeding to Phase 3.

---

## Phase 3: Migrate the Buffered CLI and Remove Streaming Duplication

### Overview

Replace the existing CLI’s embedded agent logic with the reusable API, retain the standard buffered command, and remove the streamed implementation and script.

### Changes Required:

#### 1. Thin buffered CLI adapter

**Files**: `packages/code-reviewer/src/review.ts`

**Intent**: Keep the existing command-line workflow while making this file responsible only for dotenv initialization, stdin collection, stderr operational messages, public API invocation, and JSON stdout.

**Contract**: The CLI reads a complete diff from stdin, calls the public buffered reviewer once, writes only the final formatted review JSON to stdout, and preserves actionable failures on stderr with a non-zero exit status.

#### 2. Remove streamed command path

**Files**: `packages/code-reviewer/src/review-streamed.ts` (delete), `packages/code-reviewer/package.json`

**Intent**: Remove the duplicate streamed runtime and its raw event logging as explicitly requested.

**Contract**: Delete `start-streamed`; preserve `start` as the buffered CLI command and update `dev` to watch the retained adapter or another documented buffered entry point.

#### 3. Align CLI documentation and environment examples

**Files**: `packages/code-reviewer/README.md`, `packages/code-reviewer/.env.example`

**Intent**: Document the library/CLI split, one standard command, Codex CLI authentication behavior, optional `CODEX_MODEL`, and the same API-key variable in both files when an API key is used.

**Contract**: README examples use `git diff | npm run start`; `.env.example` contains only supported optional configuration names and no credentials.

### Success Criteria:

#### Automated Verification:

- `npm run check` succeeds after the streamed file and script are removed.
- `npm run` lists `start` but does not list `start-streamed`.

#### Manual Verification:

- `git diff | npm run start` produces a valid review JSON document on stdout using local Codex CLI authentication.
- Running `npm run start` with no closed stdin immediately reports that it is waiting for a diff, and a failed agent request is reported on stderr rather than producing invalid stdout.

**Implementation Note**: After automated verification passes, manually verify the stdin-to-JSON workflow before proceeding to Phase 4.

---

## Phase 4: Verify the Package Boundary and Handoff

### Overview

Confirm the documented reusable API and CLI work from a clean package installation without introducing a test framework, Promptfoo, or evaluation configuration.

### Changes Required:

#### 1. Package boundary verification and documentation handoff

**Files**: `packages/code-reviewer/package.json`, `packages/code-reviewer/README.md`

**Intent**: Ensure scripts and documented usage describe the final package accurately and provide a clear future integration point for evaluation code.

**Contract**: Keep the package private, retain TypeScript and runtime dependencies needed by the modular implementation, and document import-based use of the public API without naming or configuring an eval tool.

### Success Criteria:

#### Automated Verification:

- From `packages/code-reviewer`, `npm install` followed by `npm run check` succeeds.
- `npm pack --dry-run` includes the source and package metadata needed for the documented package boundary and excludes ignored secrets and dependencies.

#### Manual Verification:

- Follow the README’s CLI example in a repository with a small diff and confirm the result remains valid JSON.
- Follow the README’s import example from a one-off TypeScript consumer and confirm importing does not read stdin, log, or start Codex before a review method is called.

**Implementation Note**: After automated verification passes, manually confirm the CLI and import workflows before considering the change ready for implementation review.

---

## Testing Strategy

### Unit Tests:

- No test framework or test suite is added in this change, per scope decision.
- Phase-level fixture checks use one-off `tsx` commands and an injected stubbed runner to validate pure contracts and error paths without Codex credentials.

### Integration Tests:

- Use the existing `npm run check` gate for TypeScript coverage.
- Manually exercise the buffered CLI with a small Git diff and local Codex CLI authentication.

### Manual Testing Steps:

1. Run the schema/prompt fixtures from Phase 1 and verify strict score validation.
2. Run the public factory against a stubbed runner from Phase 2 and verify both success and `CodeReviewError` failure paths.
3. Pipe a small `git diff` into `npm run start` and verify stdout is parseable review JSON.
4. Confirm `src/review-streamed.ts` and `start-streamed` are absent and README documentation only presents buffered operation.

## Performance Considerations

The refactor should not add extra Codex turns or change the one-request buffered execution model. Prompt construction should avoid duplicating the diff in memory beyond the existing request and parsing boundaries.

## Migration Notes

This is an internal package refactor with no persisted data migration. Existing users of `npm run start` retain the same stdin-to-JSON behavior; `start-streamed` is intentionally removed and callers needing observability should integrate through the future reusable API rather than the deleted raw-event CLI.

## References

- Existing buffered CLI: `packages/code-reviewer/src/review.ts:1-63`
- Existing streamed CLI to remove: `packages/code-reviewer/src/review-streamed.ts:1-94`
- Package scripts and dependencies: `packages/code-reviewer/package.json:1-21`
- Current package usage documentation: `packages/code-reviewer/README.md:1-38`
- Repository planning rule: `context/foundation/lessons.md:10-13`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract Pure Review Contracts

#### Automated

- [x] 1.1 `npm run check` succeeds with the extracted pure modules. — b3c71ee
- [x] 1.2 Public schema types represent the required verdict and score fields. — b3c71ee

#### Manual

- [x] 1.3 Validate valid and invalid review fixtures through the exported schema. — b3c71ee
- [x] 1.4 Inspect a generated prompt with a fixture diff. — b3c71ee

### Phase 2: Create the Reusable Buffered Agent API

#### Automated

- [x] 2.1 `npm run check` succeeds with the agent interfaces and public index exports. — de9184d
- [x] 2.2 Type-check a consumer-style import from `src/index.ts`. — de9184d

#### Manual

- [x] 2.3 Invoke the public factory with a stubbed runner/client and validate the result. — de9184d
- [x] 2.4 Verify malformed and invalid fixture results throw `CodeReviewError`. — de9184d

### Phase 3: Migrate the Buffered CLI and Remove Streaming Duplication

#### Automated

- [x] 3.1 `npm run check` succeeds after streamed code removal. — 79b6755
- [x] 3.2 Confirm `npm run` retains `start` and removes `start-streamed`. — 79b6755

#### Manual

- [x] 3.3 Pipe a Git diff to `npm run start` and validate the JSON result. — 79b6755
- [x] 3.4 Verify stdin waiting and runtime failures report to stderr without corrupting stdout. — 79b6755

### Phase 4: Verify the Package Boundary and Handoff

#### Automated

- [x] 4.1 Run `npm install` and `npm run check` from the package directory.
- [x] 4.2 Run `npm pack --dry-run` and inspect its contents.

#### Manual

- [x] 4.3 Follow the README CLI workflow with a small diff.
- [x] 4.4 Import the documented public API and confirm no side effects occur until review invocation.
