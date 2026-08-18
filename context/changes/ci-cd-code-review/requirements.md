## Operational setup

- The workflow targets pull requests to `main` and is advisory; it must not be configured as a required branch-protection check.
- Configure `OPENAI_API_KEY` as a repository Actions secret before the first same-repository review. `CODEX_MODEL` is optional.
- Create `ai-cr:review` (blue, `1D76DB`), `ai-cr:passed` (green, `0E8A16`), and `ai-cr:failed` (red, `B60205`) before enabling the workflow. Adding the retry label refreshes the single managed comment and removes the retry label after successful publication.
- Fork-originated pull requests are intentionally skipped and never receive the review credential.
- Verify the change locally with `npm run verify`, `npm run check --prefix packages/code-reviewer`, and `npm test --prefix packages/code-reviewer`.
- No deployment workflow or GitHub branch-protection setting is part of this change.

## Overall concept

- GHA workflow run for every new pull request to main
- composite action for the review itself so that main workflow is easy to reason about

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

Each criterion is scored on a 1–10 scale, where 1 is the worst outcome and 10 is the best.

{{CR_CRITERIA}}

## Parked for later

- business alignment (require broader context)
- architectural fit (require broader context)

## Expected side-effects

- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior

- on-demand retry when label `ai-cr:review` is added
