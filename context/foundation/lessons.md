# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Submit Form Posts in the Background

- **Context**: Every time there is a form post
- **Problem**: The page is completely refreshed, losing the scrolling position.
- **Rule**: The form post call should be done in the background without page refresh.
- **Applies to**: implement
