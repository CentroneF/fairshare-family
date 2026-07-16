---
project: fairshare-family
researched_at: 2026-07-16T00:00:00Z
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 with React islands
  runtime: Cloudflare Workers via @astrojs/cloudflare 13 and Wrangler 4
---

## Recommendation

**Deploy on Cloudflare Workers.**

The repository already uses Astro server output, `@astrojs/cloudflare`, a Worker entrypoint, and Wrangler 4. This avoids an adapter/runtime migration while fitting the cost-first MVP: Workers Free allows up to 100,000 requests per day, far above the expected 10k–100k monthly requests. Supabase remains the managed authentication and PostgreSQL provider. [Astro adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) · [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Platform Comparison

| Platform | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP/integration | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Cloudflare Workers | Pass | Pass | Pass | Pass | Partial | 4P / 1 partial |
| Netlify | Pass | Pass | Pass | Pass | Partial | 4P / 1 partial |
| Render | Pass | Pass | Pass | Pass | Pass | 5P |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4P / 1 partial |
| Fly.io | Pass | Partial | Pass | Pass | Fail | 3P / 1 partial |
| Railway | Pass | Pass | Pass | Partial | Partial | 3P / 2 partial |

Cloudflare wins despite Render's formal score because the existing stack is Cloudflare-native and Workers has predictable free-tier request capacity. Netlify and Render would require replacing the Cloudflare adapter; Vercel additionally has commercial-plan and cost-predictability concerns. Fly.io and Railway add an always-on container/service model that the MVP does not need.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Astro 6 supports SSR, server islands, actions, and sessions with the installed adapter. Wrangler provides deterministic deployment, live logs, and rollback. The primary constraints are the Workers runtime, the free plan's 10 ms CPU limit, and the fact that code rollbacks do not change Supabase data. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

#### 2. Netlify

Netlify provides an Astro adapter, deploy previews, a mature CLI, and a $0 credit-based tier. It is a credible fallback, but requires replacing the current adapter and validating runtime-specific APIs. Its metered credits make long-term cost less transparent. [Netlify Astro guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/astro/) · [pricing](https://www.netlify.com/pricing/)

#### 3. Render

Render offers a free static option and solid CLI/API tooling. This SSR app would instead need a Node adapter and a web service; its free web services sleep after inactivity, making cold starts a poor fit for a family finance app. [Render Astro guide](https://render.com/docs/deploy-astro) · [free tier](https://render.com/docs/free)

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. The free plan's 10 ms CPU limit may be too small for inefficient SSR, large report calculations, or future server-side document generation.
2. Workers is not full Node.js; every server-side npm dependency must be checked against the Worker runtime.
3. Supabase requests count as external subrequests; the free plan allows 50 per Worker request.
4. `wrangler rollback` restores code, not Supabase schema or data.
5. Recurring expenses need deliberate scheduling and idempotency rather than an in-request shortcut.

### Pre-Mortem — How This Could Fail

Six months after launch, the deployment becomes painful because the team assumes that every npm package is Worker-compatible. A reporting or export dependency uses an unsupported Node feature and must be replaced late. An inefficient monthly calculation begins exceeding Worker CPU limits, and the free-plan limit was never measured. A hurried rollback restores an old Worker after a Supabase migration, leaving code and schema incompatible. Finally, recurring expenses are created in a non-idempotent job, so a retry creates duplicates. These failures are prevented by compatibility checks for new server dependencies, profiling report paths, forward-only database migrations, and database-enforced idempotency for scheduled work.

### Unknown Unknowns

- Astro 6 uses the unified `@astrojs/cloudflare/entrypoints/server` Worker entrypoint; the project already has the correct configuration.
- Astro's normal `npm run dev` is the appropriate development loop; a separate legacy Worker dev command is unnecessary for this adapter setup.
- Rollback immediately changes active Worker code but leaves connected services and data unchanged.
- Cloudflare is edge-hosted, but the Supabase project region—not the Worker region—is the important database-latency choice for the single-region audience.
- Astro 6's Cloudflare adapter targets Workers, not Pages. [Astro adapter notes](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) · [rollback behavior](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

## Operational Story

- **Preview deploys**: Use Cloudflare's Git integration or deploy non-production Worker versions from a branch; protect any preview that can reach production Supabase data. Use a separate Supabase project or branch for previews before enabling them.
- **Secrets**: Keep local secrets in ignored `.dev.vars`; set production values with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. Only account members with Worker-secret access may read or rotate them.
- **Rollback**: Use `npx wrangler rollback <VERSION_ID>` to republish a prior Worker version. Do not roll back across an incompatible Supabase migration; ship a forward corrective migration instead.
- **Approval**: A human approves production publish, secret rotation, and any Supabase schema/data migration. An agent may run read-only lint, build, preview, migration-status, and log commands unattended.
- **Logs**: Use `npx wrangler tail <worker-name> --format json` for live runtime logs and GitHub Actions logs for build/deployment output. [Wrangler tail](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Code rollback conflicts with changed database schema | Devil's advocate | M | H | Use expand/contract, forward-only Supabase migrations; test old and new code against additive schema before production deployment. |
| Unsupported server-side npm dependency | Devil's advocate | M | M | Add a Worker compatibility check and production build test before accepting each server-only dependency; prefer browser-side export libraries. |
| Worker CPU or subrequest limits | Research finding | L | M | Measure report routes; keep calculations in SQL where possible; monitor before moving off the free tier. |
| Duplicate recurring expenses after job retries | Pre-mortem | M | H | Use a Cron Trigger calling an idempotent Supabase RPC with a unique `(recurring_expense_id, year_month)` constraint. |
| Missed monthly job | Unknown unknowns | L | M | Calculate balances from stored data on request; treat cron only as occurrence materialization and surface failed-run monitoring. |
| Slow initial export or incompatible workbook library | Devil's advocate | M | L | Start with client-side CSV or a browser-compatible `.xlsx` library; test the exact library before server-side use. |
| Preview accidentally uses production data | Research finding | M | H | Use distinct Supabase credentials/projects for preview and production; never expose service-role keys. |

## Getting Started

1. Rename the Worker in `wrangler.jsonc` from `10x-astro-starter` to `fairshare-family`; keep `main: "@astrojs/cloudflare/entrypoints/server"` and the existing `nodejs_compat` flag.
2. Create a Cloudflare account, authenticate locally with `npx wrangler login`, then set the production Supabase secrets with `npx wrangler secret put`.
3. Run `npm run lint` and `npm run build`; use the existing `npm run dev` loop for Astro development.
4. Deploy with `npx wrangler deploy`, verify the returned Worker URL, and inspect runtime output with `npx wrangler tail fairshare-family --format json`.
5. Before recurring expenses ship, add a UTC Cron Trigger in `wrangler.jsonc` and an idempotent Supabase migration/RPC; use forward-only migrations for all production schema changes. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)

## Out of Scope

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture, including multi-region HA and disaster recovery
