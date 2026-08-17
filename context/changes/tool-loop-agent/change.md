---
change_id: tool-loop-agent
title: Modular Codex code-review agent
status: implementing
created: 2026-08-17
updated: 2026-08-17
archived_at: null
---

## Notes

Refactor `packages/code-reviewer` into a reusable, buffered Codex SDK review agent. Extract prompts and structured output schemas, provide a side-effect-free public API for future Promptfoo use, retain the standard CLI, and remove the streamed CLI. Promptfoo and any evaluation environment configuration are explicitly out of scope.
