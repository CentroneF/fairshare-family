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

## 10xDevs AI Toolkit - Module 2, Lesson 5

Scale the single-change cycle into parallel work with **worktrees, goal-directed delegation, and multi-session orchestration**:

```
worktree per change -> /goal or your AI coding assistant -p -> PR -> review -> merge
```

The lesson focus is safe throughput: isolated contexts, choosing the right execution mode, and capping parallelism at review capacity.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code isolation** | |
| `git worktree add` | You need a separate working directory for a parallel change. One change per worktree, one fresh agent context per worktree. |
| **Complex changes** | |
| `/10x-implement <change-id> phase <n>` | The change has multiple phases, needs manual gates, or benefits from interactive decision-making during execution. |
| **Simple changes** | |
| `/goal` | You have a clear, bounded task and want goal-directed delegation. The agent works autonomously toward the stated goal with a stop condition. |
| `your AI coding assistant -p` | You want headless execution for a well-defined task. The Ralph Wiggum loop (run, check, retry) is the universal autonomous pattern. |
| **Multi-session orchestration** | |
| Superset / Conductor / Antigravity / VS Code Agent View | You are running multiple agent sessions in parallel and need visibility, coordination, or session management across them. |

### Parallel work rules

- One change per worktree or isolated workspace. One fresh agent context per change.
- Choose interactive `/10x-implement` for complex changes, `/goal` or `your AI coding assistant -p` for simple ones.
- Parallelism is capped by review capacity. More agents without review means more unreviewed code, not higher throughput.
- The quality pain from faster shipping is intentional — it bridges into Module 3 testing gates.

### Lesson boundaries

- Do not reteach interactive `/10x-implement` or `/10x-impl-review`; those are Lessons 2 and 3.
- Do not introduce testing strategy here. The quality pain is the motivation for Module 3.
- Worktrees are a mechanism for isolation, not the topic of a full git tutorial.

### Paths used by this lesson

- `context/changes/<change-id>/` - active change folder
- `context/changes/<change-id>/plan.md` - implementation input for any execution mode

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
