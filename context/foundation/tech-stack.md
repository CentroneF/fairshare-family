---
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
---

## Why this stack

FairShare Family is a medium-scale TypeScript web app with a five-week after-hours target and required authentication. The 10x Astro Starter is the vetted default for this product and language combination, providing explicit types, established conventions, authentication, database access, and a Cloudflare-first deployment path. GitHub Actions will run checks and deploy automatically after merges to `main`. Recurring monthly expenses are recorded as scheduled work in scope, but their scheduler will be added separately because the starter does not bundle long-running background jobs. Scaffolding support is first-class, so occasional manual steps remain possible.
