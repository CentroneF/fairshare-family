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

### [x] Phase 3 — Configure Cloudflare Workers Builds

- [x] Connect `CentroneF/fairshare-family` through Cloudflare’s GitHub integration.
- [x] Set `main` as the only production build branch and turn off non-production branch builds.
- [x] Configure the Cloudflare build command as `npm ci && npx astro sync && npm run lint && npm run build`; configure deploy as `npx wrangler deploy`.
- [x] Use Cloudflare-managed build authentication rather than committing a Wrangler API token. Configure runtime secrets in **Variables & Secrets**, not build variables.
- [x] Treat a failed Cloudflare build, missing runtime secret, Worker-name mismatch, or absent generated assets as a deployment stop; inspect the Workers Build log before retrying. The initial build failure was corrected and the rerun deployed successfully.
- [x] Keep `main` protected from direct pushes and use pull requests for merges. `main` requires a pull request, enforces the rule for admins, and blocks force-pushes and deletions; the first GitHub-triggered build deployed successfully.
