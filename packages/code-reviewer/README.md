# Code Reviewer

A reusable, buffered code-review agent powered by the Codex SDK. The library reviews pull request title, optional description, and Git diff, then returns structured JSON with six scores, a pass/fail verdict, and an actionable Markdown summary. The CLI accepts a structured JSON request file and writes the result to stdout.

## Prerequisites

- Node.js 18 or later
- Codex CLI authentication configured locally. If your Codex setup uses an API key, configure `OPENAI_API_KEY` through your normal environment management or a local `.env` file; do not commit it.

## Install

```bash
npm install
```

## Usage

Optionally set `CODEX_MODEL` in `.env` to select the model used for reviews. If it is unset, Codex uses its configured default.

Review a pull request request file:

```bash
cat > /tmp/review-request.json <<'EOF'
{
  "title": "Add expense export",
  "body": "Exports are available from the monthly report.",
  "diff": "...git diff..."
}
EOF
npm run start -- --request /tmp/review-request.json
```

Watch the TypeScript entry point during development:

```bash
npm run dev
```

Validate types:

```bash
npm run check
```

Run deterministic tests without Codex credentials:

```bash
npm test
```

The CLI entry point is `src/cli.ts`. `title` and `diff` are required; `body` is optional and must be omitted when empty. The agent runs with a read-only sandbox and requests approval only when required by Codex policy.

## GitHub Actions composite action

`.github/actions/ai-reviewer` runs this package from the trusted base-branch checkout. It accepts a GitHub token and pull-request number, retrieves the PR title, non-empty body, and base-to-head diff through the GitHub API, and keeps its temporary JSON request internal to the action. Its `api-key` input maps only to `OPENAI_API_KEY`; the optional `model` input maps to `CODEX_MODEL` and defaults to `gpt-5.6-sol`. It exposes validated review JSON plus its advisory verdict. The action uses `npm ci` and checks TypeScript before invoking the CLI.

It exposes two outputs: `result` (the raw validated six-score JSON) and `verdict` (`pass` or `fail`). A `fail` verdict is an advisory review result and does not cause the action to fail. Invalid request JSON, schema-invalid reviewer output, or model execution errors cause the action to fail with diagnostics on stderr.

## GitHub Actions setup

The workflow at `.github/workflows/ai-code-review.yml` runs for opened, reopened, synchronized, and qualifying `ai-cr:review`-labelled pull requests to `main`. Add `OPENAI_API_KEY` as a repository Actions secret before merging it. `CODEX_MODEL` is optional; omit it to use the action default.

Create these repository labels before enabling the workflow:

| Label | Color | Purpose |
| --- | --- | --- |
| `ai-cr:review` | blue (`1D76DB`) | Request a retry. The workflow removes it after a successful publication. |
| `ai-cr:passed` | green (`0E8A16`) | Advisory `pass` verdict. |
| `ai-cr:failed` | red (`B60205`) | Advisory `fail` verdict. |

Reviews are advisory: an AI `fail` publishes feedback and does not make the workflow fail or alter GitHub branch protection. Only same-repository PRs run the reviewer; fork-originated PRs are skipped so the API secret is never exposed. Every completed qualifying review, including a successful retry, adds a new comment that preserves the review history. The `ai-cr:passed` or `ai-cr:failed` label reflects only the latest result.

Before opening a PR, run the root gate and the reviewer package gates:

```bash
npm run verify
npm run check --prefix packages/code-reviewer
npm test --prefix packages/code-reviewer
```

## Library API

Import from `src/index.ts` when embedding the reviewer. Imports are side-effect free: they do not load dotenv, read stdin, write to the console, or start Codex until `review` is called.

```ts
import { createCodeReviewer } from "./src/index.js";

const reviewer = createCodeReviewer({ model: process.env.CODEX_MODEL });
const result = await reviewer.review({
  title: "Add expense export",
  body: "Exports are available from the monthly report.",
  diff: "...git diff...",
});
```

Each result includes 1–10 scores for implementation correctness, idiomaticity, complexity, test/risk coverage, documentation, and security/safety, plus a `pass`/`fail` verdict and Markdown summary. For deterministic integrations, pass a compatible `runner` to `createCodeReviewer`. The package also exports `review`, `reviewSchema`, `reviewRequestSchema`, `reviewJsonSchema`, `buildCodeReviewPrompt`, and `CodeReviewError`.

## Scoring rubric

The score anchors describe the ends of each 1–10 scale; the advisory `pass`/`fail` verdict is a separate model judgment.

| Criterion | Grade 1 | Grade 10 |
| --- | --- | --- |
| Implementation correctness | Logic is broken, misses obvious edge/error cases, or silently regresses existing behavior. | Works across happy paths, edge cases, and failure modes without regressions. |
| Idiomaticity | Fights the stack and repository patterns; reads as foreign. | Matches well-written surrounding code and uses the right idioms naturally. |
| Complexity | Is over-engineered or tangled, with accidental complexity that obscures intent. | Is the minimal, clear design that completely solves the problem. |
| Test/risk coverage | Risky logic is untested, or tests are absent, trivial, or unhelpful. | Tests the paths most likely to break deliberately and in proportion to risk. |
| Documentation | Leaves needed intent opaque, forcing readers to reverse-engineer it. | Explains the why behind non-obvious decisions without restating the obvious. |
| Security/safety | Introduces an exploitable flaw, leaks secrets, or unsafely trusts untrusted input. | Validates input, handles secrets correctly, and opens no new attack surface. |
