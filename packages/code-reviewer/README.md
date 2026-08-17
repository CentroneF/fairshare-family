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
