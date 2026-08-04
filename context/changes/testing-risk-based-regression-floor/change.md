---
change_id: testing-risk-based-regression-floor
title: Establish a risk-based regression floor
status: implementing
created: 2026-08-04
updated: 2026-08-04
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Risk-based regression floor".
Risks covered: cross-cutting regression protection for financial state transitions and family authorization boundaries.
Test types planned: test commands + quality gates.
Risk response intent:
- Make the shipped unit and database-integration patterns runnable through documented, reliable commands.
- Challenge the assumption that tests existing locally are automatically enforced before changes land.
- Preserve cost × signal: do not add browser, snapshot, or AI-native layers where the existing deterministic seams provide protection.
After creating the folder, follow the downstream continuation rule.
