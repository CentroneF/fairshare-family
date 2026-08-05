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

See `@package.json` for the current scripts. Run `npm run dev` for local development, and run `npm run verify` (Vitest, lint, then production build) before opening a PR; use `npm test` alone for focused feedback. Pull requests targeting `main` run the same `npm run verify` gate, but repository branch-protection settings are external. Run `npx supabase test db` after starting the local Supabase stack when changing migrations or RLS; this database gate is not part of generic CI. Do not run `supabase db reset` during normal development: it recreates the local database and deletes local `auth.users`; apply migrations incrementally instead, and reset only with explicit user approval. Run `npm run lint:fix` or `npm run format` only when the resulting diff is limited to intended files; review all generated changes before committing.

Unit tests use Vitest beside affected `src/` modules; database integration tests live under `supabase/tests/` and run through the Supabase CLI.

## Coding Style & Naming Conventions

Formatting and linting rules live in `@.prettierrc.json` and `@eslint.config.js`. Use PascalCase for component files (`SignInForm.tsx`), camelCase for functions and variables, and lowercase route filenames (`confirm-email.astro`). Prefix intentionally unused values with `_` to satisfy ESLint.

Use Tailwind utility classes for component styling. Keep server-only secrets out of client code and use the existing Supabase helpers rather than creating duplicate clients.

## Commit & Pull Request Guidelines

Use Conventional Commit-style subjects, as in `chore: bootstrap FairShare Family Astro starter`. Prefer concise prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, and `chore:`. Each commit must contain one independently reviewable change; do not mix unrelated feature, formatting, and configuration work.

PRs should explain the user-visible change, link the relevant issue or context change when applicable, list validation performed (`npm run lint`, `npm run build`), and include screenshots for UI changes. Do not commit `.env` or `.dev.vars`; copy `.env.example` instead.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
