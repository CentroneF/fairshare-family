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

See `@package.json` for the current scripts. Run `npm run dev` for local development, and run `npm run lint` plus `npm run build` before opening a PR. Run `npm run lint:fix` or `npm run format` only when the resulting diff is limited to intended files; review all generated changes before committing.

There is no automated test runner yet. When introducing one, add a `test` script to `package.json`, place tests beside or under the affected `src/` area, and document the command here.

## Coding Style & Naming Conventions

Formatting and linting rules live in `@.prettierrc.json` and `@eslint.config.js`. Use PascalCase for component files (`SignInForm.tsx`), camelCase for functions and variables, and lowercase route filenames (`confirm-email.astro`). Prefix intentionally unused values with `_` to satisfy ESLint.

Use Tailwind utility classes for component styling. Keep server-only secrets out of client code and use the existing Supabase helpers rather than creating duplicate clients.

## Commit & Pull Request Guidelines

Use Conventional Commit-style subjects, as in `chore: bootstrap FairShare Family Astro starter`. Prefer concise prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, and `chore:`. Each commit must contain one independently reviewable change; do not mix unrelated feature, formatting, and configuration work.

PRs should explain the user-visible change, link the relevant issue or context change when applicable, list validation performed (`npm run lint`, `npm run build`), and include screenshots for UI changes. Do not commit `.env` or `.dev.vars`; copy `.env.example` instead.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code review (lesson focus)** | |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome** | |
| `/10x-lesson` | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note. |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
