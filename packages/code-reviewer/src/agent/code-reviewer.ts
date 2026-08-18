import { Codex } from "@openai/codex-sdk";

import { CodeReviewError } from "../errors/code-review-error.js";
import { buildCodeReviewPrompt } from "../prompts/code-review.js";
import { reviewJsonSchema, reviewSchema, type Review, type ReviewRequest } from "../schemas/review.js";
import type { CodeReviewRunner } from "./contracts.js";

export interface CodeReviewerOptions {
  /** Supplies deterministic or alternative execution without starting the Codex CLI. */
  runner?: CodeReviewRunner;
  /** Overrides CODEX_MODEL for this reviewer instance. */
  model?: string;
}

export interface CodeReviewer {
  review(request: ReviewRequest): Promise<Review>;
}

function getRunner(runner?: CodeReviewRunner): CodeReviewRunner {
  return runner ?? new Codex();
}

export function createCodeReviewer(options: CodeReviewerOptions = {}): CodeReviewer {
  const runner = getRunner(options.runner);
  const configuredModel = process.env.CODEX_MODEL?.trim();
  const model = options.model ?? (configuredModel === "" ? undefined : configuredModel);

  return {
    async review(request: ReviewRequest): Promise<Review> {
      let finalResponse: string;

      try {
        const thread = runner.startThread({
          model,
          sandboxMode: "read-only",
          approvalPolicy: "on-request",
        });
        const turn = await thread.run(buildCodeReviewPrompt(request), { outputSchema: reviewJsonSchema });
        finalResponse = turn.finalResponse;
      } catch (cause) {
        if (cause instanceof CodeReviewError) throw cause;
        throw new CodeReviewError("Code review execution failed", { stage: "execution" }, { cause });
      }

      if (!finalResponse) {
        throw new CodeReviewError("Code review returned no final response", { stage: "missing-output" });
      }

      let output: unknown;
      try {
        output = JSON.parse(finalResponse);
      } catch (cause) {
        throw new CodeReviewError("Code review returned invalid JSON", { stage: "invalid-json" }, { cause });
      }

      const parsed = reviewSchema.safeParse(output);
      if (!parsed.success) {
        throw new CodeReviewError("Code review returned invalid structured output", {
          stage: "invalid-output",
          details: parsed.error.issues,
        });
      }

      return parsed.data;
    },
  };
}
