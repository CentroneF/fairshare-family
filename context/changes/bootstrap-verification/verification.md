---
bootstrapped_at: 2026-07-15T12:01:59Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: fairshare-family
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: fairshare-family
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: true
```

## Why this stack

FairShare Family is a medium-scale TypeScript web app with a five-week after-hours target and required authentication. The 10x Astro Starter is the vetted default for this product and language combination, providing explicit types, established conventions, authentication, database access, and a Cloudflare-first deployment path. GitHub Actions will run checks and deploy automatically after merges to `main`. Recurring monthly expenses are recorded as scheduled work in scope, but their scheduler will be added separately because the starter does not bundle long-running background jobs. Scaffolding support is first-class, so occasional manual steps remain possible.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | unavailable | The template begins with `git clone`; additionally, npm could not use the shared cache because it contains root-owned files. |
| GitHub repo | not run | unavailable | `gh` is not installed. |

## Scaffold log

**Resolved invocation**: `NPM_CONFIG_CACHE=/private/tmp/child-expenses-npm-cache git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 20 top-level items

**Conflicts (.scaffold siblings)**: none

**.gitignore handling**: moved silently

**.bootstrap-scaffold cleanup**: deleted

**Git history**: the starter's cloned `.git/` directory was deleted before the move; the existing repository history was preserved.

## Post-scaffold audit

**Tool**: `npm audit --json`

**Exit code**: 1 (informational; npm returns non-zero when findings exist)

**Summary**: 0 CRITICAL, 6 HIGH, 9 MODERATE, 2 LOW

**Direct vs transitive**: 1/0/2/0 direct of total 6/0/9/2 (the first value is HIGH; no critical findings). Direct packages: `astro` (HIGH), `supabase` (MODERATE), `wrangler` (MODERATE).

#### CRITICAL findings

None.

#### HIGH findings

| Package | Direct | Advisory summary |
| --- | --- | --- |
| astro | yes | Reflected XSS and SSRF advisories; affected below 6.4.6. |
| devalue | no | Sparse-array deserialization denial of service. |
| miniflare | no | Inherited `undici` and `ws` advisories. |
| undici | no | Multiple HTTP/TLS/WebSocket advisories. |
| vite | no | Windows path-handling advisory. |
| ws | no | Memory-exhaustion denial of service. |

#### MODERATE findings

`@astrojs/language-server`, `@cloudflare/vite-plugin`, `astro`, `js-yaml`, `supabase`, `tar`, `undici`, `volar-service-yaml`, `wrangler`, and `yaml-language-server` are represented in the audit dependency chains; npm reported 9 moderate vulnerable package entries, with fixes available.

#### LOW / INFO findings

`@babel/core` and `esbuild` (2 LOW); no INFO findings. Fixes are available.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | true |

## Next steps

Next: a future skill will set up agent context (`CLAUDE.md`, `AGENTS.md`). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- Review the audit findings and update the starter dependencies according to your risk tolerance.
- Configure Supabase and Cloudflare environment variables using `.env.example`.
- Review `README.md` and initialize or commit your own repository history as needed.
