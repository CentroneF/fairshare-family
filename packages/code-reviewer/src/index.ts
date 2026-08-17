import { createCodeReviewer } from "./agent/code-reviewer.js";

export { createCodeReviewer } from "./agent/code-reviewer.js";
export type { CodeReviewer, CodeReviewerOptions } from "./agent/code-reviewer.js";
export type {
  CodeReviewRunOptions,
  CodeReviewRunner,
  CodeReviewThread,
  CodeReviewThreadOptions,
  CodeReviewTurn,
} from "./agent/contracts.js";
export { CodeReviewError } from "./errors/code-review-error.js";
export type { CodeReviewErrorContext } from "./errors/code-review-error.js";
export { buildCodeReviewPrompt, CODE_REVIEW_SYSTEM_PROMPT } from "./prompts/code-review.js";
export { reviewJsonSchema, reviewRequestSchema, reviewSchema } from "./schemas/review.js";
export type { Review, ReviewRequest } from "./schemas/review.js";

/** Reviews pull request metadata and a diff with the production Codex runner. */
export async function review(request: import("./schemas/review.js").ReviewRequest) {
  return createCodeReviewer().review(request);
}
