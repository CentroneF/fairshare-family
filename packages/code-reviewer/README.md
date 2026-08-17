# Code Reviewer

A command-line code-review agent powered by the Codex SDK. It reads a Git diff from standard input and returns a structured JSON review with scores, a pass/fail verdict, and an actionable Markdown summary.

## Prerequisites

- Node.js 18 or later
- Codex authentication configured locally, or an `OPENAI_API_KEY` environment variable

## Install

```bash
npm install
```

## Usage

Optionally set `CODEX_MODEL` in `.env` to select the model used for reviews. If it is unset, Codex uses its configured default.

Review the current working tree:

```bash
git diff | npm run start
```

Watch the TypeScript entry point during development:

```bash
npm run dev
```

Validate types:

```bash
npm run check
```

The entry point is `src/review.ts`. The agent runs with a read-only sandbox and requests approval only when required by Codex policy.
