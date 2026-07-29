# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Submit Form Posts in the Background

- **Context**: Every time there is a form post
- **Problem**: The page is completely refreshed, losing the scrolling position.
- **Rule**: The form post call should be done in the background without page refresh.
- **Applies to**: implement

## Plan Vertical End-to-End Phases

- **Context**: plan a change
- **Problem**: every time I plan a change, the phases are horizontal, not vertical on the full stack so im not able to manually verify the changes from the frontend
- **Rule**: Plan vertical, end-to-end phases so each phase is manually verifiable from the frontend.
- **Applies to**: plan

## Create a Branch for Every New Change

- **Context**: When working on a change implementation
- **Problem**: The changes are committed to main.
- **Rule**: When using `/10x-new`, a new branch should be checked out named like the change ID.
- **Applies to**: new
