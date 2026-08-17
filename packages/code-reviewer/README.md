# Code Reviewer

A reusable, buffered code-review agent powered by the Codex SDK. The library reviews a supplied Git diff and returns structured JSON with scores, a pass/fail verdict, and an actionable Markdown summary. The included CLI is a thin stdin-to-JSON adapter around that public API.

## Prerequisites

- Node.js 18 or later
- Codex CLI authentication configured locally. If your Codex setup uses an API key, configure `OPENAI_API_KEY` through your normal environment management rather than this package's `.env` file.

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

The CLI entry point is `src/cli.ts`. The agent runs with a read-only sandbox and requests approval only when required by Codex policy.

## Library API

Import from `src/index.ts` when embedding the reviewer. Imports are side-effect free: they do not load dotenv, read stdin, write to the console, or start Codex until `review` is called.

```ts
import { createCodeReviewer } from "./src/index.js";

const reviewer = createCodeReviewer({ model: process.env.CODEX_MODEL });
const result = await reviewer.review({ diff: "...git diff..." });
```

For deterministic integrations, pass a compatible `runner` to `createCodeReviewer`. The package also exports `review`, `reviewSchema`, `reviewJsonSchema`, `buildCodeReviewPrompt`, and `CodeReviewError`.
