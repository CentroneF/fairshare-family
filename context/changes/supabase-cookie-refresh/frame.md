# Frame Brief: Supabase cookie refresh

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Astro logs: `Astro.cookies.set() was called after the cookies had already been sent to the browser`, with the call originating at `src/lib/supabase.ts:19` during Supabase `_callRefreshToken`.

## Initial Framing (preserved)

- **User's stated cause or approach**: Multiple request-scoped Supabase clients, including one in an imported component, cause a late token refresh.
- **User's proposed direction**: Create one client in middleware and reuse it through request locals and pages.
- **Pre-dispatch narrowing**: Both the warning and possible session-refresh/sign-out reliability are in scope.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Cookie-write timing during Astro rendering** — an imported component invokes a token-refresh-capable client after the response has begun streaming.
2. **Request-scoped client lifecycle** — middleware, pages, and components construct separate clients in one request. ← initial framing
3. **Cookie source consistency** — every client parses the original request `Cookie` header, so a refreshed cookie is not visible to later clients in the same request.
4. **Endpoint-specific authentication** — API handlers create their own clients, but their bodies have not streamed, so they are not the source of this page-render warning.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Component-level client writes too late | `ExpenseWorkspace.astro:17-18` creates and uses a client in imported component frontmatter; `dashboard.astro:48-54, 101-107` renders it; `supabase.ts:17-20` maps refresh cookies directly to `Astro.cookies.set`. The supplied stack confirms the token-refresh timing. | STRONG |
| Multiple clients per rendered request | Middleware creates one at `middleware.ts:7-13`; dashboard creates another at `dashboard.astro:13`; the component creates a third at `ExpenseWorkspace.astro:17`; reports repeats the middleware/page pattern at `reports.astro:9`. | STRONG |
| Stale cookie reads trigger repeat refreshes | `supabase.ts:11-15` always parses `requestHeaders.get("Cookie")`, while refresh writes via `cookies.set` at `:17-20`; no `context.locals.supabase` reuse exists. | STRONG |
| API handler is direct warning source | API routes create clients at handler entry (for example `api/expenses/create.ts:7`), but do not render streamed page components. | NONE |

## Narrowing Signals

- The warning stack identifies the only cookie setter, `src/lib/supabase.ts:19`, and Supabase's token-refresh path.
- `ExpenseWorkspace.astro` is the only imported Astro component that constructs this client.
- The concern covers both suppression of the warning and reliable persistence of refreshed sessions.

## Cross-System Convention

Session refresh is a request-level response concern: create and refresh the SSR auth client before page rendering, retain it in request locals, and let components receive data or the existing client rather than independently creating a cookie-writing client. This matches the observed request lifecycle and removes the late-write path without changing API auth behavior.

## Reframed Problem

The issue is not merely a noisy Astro log. Dashboard and reports violate a single request-scoped Supabase-client boundary: a late-rendered component can refresh the auth session after headers are committed, while duplicate clients repeatedly read stale request cookies. The change should centralize the client in middleware and eliminate server-rendered component client creation.
