# Supabase Free-Tier Keep-Alive Requirements

## Goal

Prevent this FairShare Family application's Supabase Free project from being paused because it has too little database activity over a seven-day period.

## Agreed Decisions

- Keep the solution in this repository and deploy it with the existing Cloudflare Worker.
- Remain on the Supabase Free plan; do not upgrade to Pro as part of this change.
- Run the keep-alive once per day.
- Use internal Cloudflare scheduling, not a public HTTP endpoint or a separate scheduler repository.
- Make a harmless, read-only database request that exposes no family or financial data.
- Do not introduce or use a Supabase service-role key.

## Acceptance Criteria

- The deployed Worker has a scheduled handler configured in version-controlled Wrangler configuration.
- Each scheduled run reaches Supabase using the existing server-side URL and key secrets.
- The database-side interface is safe for anonymous invocation and returns no application data.
- Failed scheduled requests are visible as failed Cloudflare Cron events without logging secrets.
- Existing Astro SSR, Cloudflare asset delivery, Supabase authentication, and RLS behavior remain unchanged.

## Constraints and Non-Goals

- This is best-effort inactivity prevention, not an uptime guarantee or an SLA.
- No application UI, user-facing routes, financial-table access, backup automation, or migration to another provider is included.
- If Supabase still pauses the project, recovery remains a manual dashboard resume; Pro is the future option for a no-pause guarantee.
