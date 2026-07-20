# Repository Guidelines

## 10x Workflow & Agent Context

Use the course workflow in order: shape and document work before selecting a stack and scaffolding; use `/10x-agents-md` to refresh this guide when conventions change. Use `/10x-rule-review <path>` to assess AI-rule files without changing them unless an edit is explicitly approved. Add recurring, evidence-backed rules through `/10x-lesson`; it appends to `context/foundation/lessons.md` and must not rewrite existing entries.

Keep this file limited to local conventions an agent could not reliably infer. Put the most important rules first and place area-specific guidance in nested `AGENTS.md` files when a subsystem develops distinct conventions. Do not write to `context/archive/`: archived changes are immutable; open a new change instead. The detailed Lesson 4 reference remains available in `AGENTS.backup.md`.

## Project Structure & Module Organization

See `@README.md` for the stack and local setup. Keep application code in `src/`:

- `src/pages/` contains file-based routes; authentication routes live in `src/pages/auth/`.
- `src/components/` holds Astro components and interactive React components; group feature-specific components (for example, `components/auth/`) together.
- `src/layouts/` provides page shells, `src/lib/` contains shared utilities and Supabase access, and `src/styles/global.css` holds global styles.
- `public/` is for static assets. Supabase local configuration belongs in `supabase/`; Cloudflare settings are in `wrangler.jsonc`.

Preserve `context/` as project-planning history; do not overwrite or move archived material under `context/archive/`.

## Build, Test, and Development Commands

See `@package.json` for the current scripts. Run `npm run dev` for local development, and run `npm test`, `npm run lint`, plus `npm run build` before opening a PR. Run `npx supabase test db` after starting the local Supabase stack when changing migrations or RLS. Run `npm run lint:fix` or `npm run format` only when the resulting diff is limited to intended files; review all generated changes before committing.

Unit tests use Vitest beside affected `src/` modules; database integration tests live under `supabase/tests/` and run through the Supabase CLI.

## Coding Style & Naming Conventions

Formatting and linting rules live in `@.prettierrc.json` and `@eslint.config.js`. Use PascalCase for component files (`SignInForm.tsx`), camelCase for functions and variables, and lowercase route filenames (`confirm-email.astro`). Prefix intentionally unused values with `_` to satisfy ESLint.

Use Tailwind utility classes for component styling. Keep server-only secrets out of client code and use the existing Supabase helpers rather than creating duplicate clients.

## Commit & Pull Request Guidelines

Use Conventional Commit-style subjects, as in `chore: bootstrap FairShare Family Astro starter`. Prefer concise prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, and `chore:`. Each commit must contain one independently reviewable change; do not mix unrelated feature, formatting, and configuration work.

PRs should explain the user-visible change, link the relevant issue or context change when applicable, list validation performed (`npm run lint`, `npm run build`), and include screenshots for UI changes. Do not commit `.env` or `.dev.vars`; copy `.env.example` instead.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
