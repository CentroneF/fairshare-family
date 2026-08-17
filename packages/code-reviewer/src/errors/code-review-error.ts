export type CodeReviewErrorContext = {
  readonly stage: "execution" | "missing-output" | "invalid-json" | "invalid-output";
  readonly details?: unknown;
};

export class CodeReviewError extends Error {
  readonly context: CodeReviewErrorContext;

  constructor(message: string, context: CodeReviewErrorContext, options?: ErrorOptions) {
    super(message, options);
    this.name = "CodeReviewError";
    this.context = context;
  }
}
