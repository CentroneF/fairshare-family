# Cloudflare Workers Production Integration & Deployment

## Summary

Deploy only the `main` branch to a single production Cloudflare Worker at its `workers.dev` URL. Use Cloudflare Workers Builds for automatic build/deploy on merge—no GitHub Actions automation, staging deployment, preview deployment, custom domain, or active cron job. Supabase remains a manually managed production integration with forward-only migrations.

## Phased implementation

### [x] Phase 0 — Local tools and account prerequisites

- [x] Repository-local Wrangler and Supabase CLI binaries are installed and available through `npx`.
- [x] Node `22.14.0` specified by `.nvmrc` is active in a fresh interactive terminal.
- [x] Run `npm ci` with Node `22.14.0` active.
- [x] Cloudflare authentication is active and `npx wrangler whoami` verifies the account.
- [x] Create or confirm the Supabase account, and enable MFA on both the Cloudflare and Supabase accounts before creating the Worker.
- [x] A Docker-compatible runtime is installed and running (Docker Engine `29.1.3`).
- [x] Run `npx supabase start`, record the local API URL and publishable key shown by the CLI, and open local Studio at `http://127.0.0.1:54323` only on the local machine.
- [x] Create the hosted Supabase production project, authenticate with `npx supabase login`, and link this repository with `npx supabase link --project-ref <production-project-ref>`.
- [x] Resolve the current missing `supabase/seed.sql` reference before using `npx supabase db reset`: add an intentionally empty committed seed file or remove the seed path from `supabase/config.toml`. Never use `supabase db reset --linked` or `--include-seed` against production.
- [x] Put local `SUPABASE_URL` and the local publishable/anon key in ignored `.dev.vars` or `.env`; use Cloudflare runtime secrets for the production equivalents. Never use a Supabase service-role/secret key in the Worker or commit any key file.

### [ ] Phase 1 — Align repository configuration

- [x] Rename the Worker in `wrangler.jsonc` to `fairshare-family`; retain the Astro 6 Worker entrypoint, `nodejs_compat`, assets binding, and observability.
- [ ] Disable Worker preview URLs and disable Cloudflare Builds for non-production branches. Worker preview URLs are disabled in `wrangler.jsonc`; configure non-production branch builds as disabled when the Cloudflare Build connection is created in Phase 3.
- [x] Rename the local Supabase `project_id` to `fairshare-family`; retain local redirect URLs for local development only.
- [x] Make `.github/workflows/ci.yml` explicitly disabled by changing it to manual dispatch only; do not delete it or retarget it to `main`.

### [ ] Phase 2 — Create and secure external services

- [x] Create one hosted Supabase production project and one Cloudflare Worker named exactly `fairshare-family`.
- [x] In Supabase production, set the Site URL to the deployed `https://fairshare-family.<account-subdomain>.workers.dev` URL and allow that exact URL plus its `/auth/confirm-email` path as redirects.
- [x] Allow immediate email/password sign-in; do not require email confirmation. Retain the confirmation route as a harmless fallback page.
- [x] Store only `SUPABASE_URL` and the browser-safe Supabase anon key as Cloudflare Worker runtime secrets. Never store the service-role key in Cloudflare, GitHub, `.env`, or `.dev.vars`.
- [ ] Enable MFA on the Supabase and Cloudflare owner accounts; restrict Cloudflare/GitHub integration access to this repository. MFA was confirmed in Phase 0; scope the GitHub connection to this repository when it is created in Phase 3.

### [ ] Phase 3 — Configure Cloudflare Workers Builds

- [x] Connect `CentroneF/fairshare-family` through Cloudflare’s GitHub integration.
- [x] Set `main` as the only production build branch and turn off non-production branch builds.
- [x] Configure the Cloudflare build command as `npm ci && npx astro sync && npm run lint && npm run build`; configure deploy as `npx wrangler deploy`.
- [x] Use Cloudflare-managed build authentication rather than committing a Wrangler API token. Configure runtime secrets in **Variables & Secrets**, not build variables.
- [ ] Treat a failed Cloudflare build, missing runtime secret, Worker-name mismatch, or absent generated assets as a deployment stop; inspect the Workers Build log before retrying. Confirm after the first GitHub-triggered build.
- [ ] Keep `main` protected from direct pushes and use pull requests for merges. `main` now requires a pull request, enforces the rule for admins, and blocks force-pushes and deletions; verify the Cloudflare Workers Build gate after the GitHub connection is configured.

### [ ] Phase 4 — Define release, database, and rollback rules

- [ ] For a schema change, create and commit an additive, backward-compatible Supabase migration and test it locally with `supabase db reset`. Before merging code that depends on the new schema, run `supabase db push --dry-run` and `supabase db push` manually against production; merge only after that succeeds so Cloudflare deploys compatible code.
- [ ] Merge code-only changes only when they remain compatible with the current production schema; Cloudflare automatically deploys the resulting Worker version.
- [ ] Use expand/contract migrations only: add before use, deploy code compatible with both schema versions, then remove obsolete columns or constraints in a later release.
- [ ] Roll back Worker code with `npx wrangler rollback <VERSION_ID>` only when the prior code remains compatible with the current Supabase schema. Otherwise, ship a forward corrective migration and code fix.
- [ ] Keep monthly recurring-expense Cron Triggers out of this deployment. When that feature is planned, add a UTC schedule plus an idempotent Supabase RPC and a unique recurrence/month constraint.

### [ ] Phase 5 — Validate and support the first release

- [ ] Verify the live `workers.dev` URL, landing page, sign-up, immediate sign-in, protected `/dashboard` redirect, sign-out, and Auth error handling.
- [ ] Confirm the deployed Worker uses production Supabase credentials without exposing values in HTML, browser bundles, repository files, or build logs.
- [ ] Check Cloudflare Workers Build history and use `npx wrangler tail fairshare-family --format json` for runtime diagnosis.
- [ ] Record the deployed Worker version ID and Supabase migration status after each release; retain these in the release note or issue for rollback support.
- [ ] If login redirects to localhost, correct Supabase URL Configuration before redeploying. If a build fails after configuration changes, first verify that the Cloudflare Worker name and `wrangler.jsonc` name still match.

## Test plan

- [ ] Build locally with the same command sequence configured in Workers Builds.
- [ ] Run lint and production build with no secrets committed locally.
- [ ] Verify a deployment from `main` succeeds and a non-`main` push does not create a deployment.
- [ ] Test sign-up/sign-in against the production Supabase project and confirm protected routes reject an unauthenticated request.
- [ ] Run a no-op `supabase db push --dry-run`, then test a harmless additive migration before relying on the manual migration process.
- [ ] Test Worker rollback only with a code-only change; verify the previous version serves requests and no Supabase data changed.

## Assumptions

- Production launches on the Cloudflare-provided `workers.dev` address; a custom domain is a later change.
- Cloudflare Workers Builds replaces automatic GitHub Actions usage; the existing workflow stays present but manually triggered only.
- There is one production Supabase project, no staging deployment, and no production data in non-production systems.
- Email confirmation remains disabled in production.
