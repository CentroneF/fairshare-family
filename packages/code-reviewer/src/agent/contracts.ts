export interface CodeReviewRunOptions {
  outputSchema: unknown;
}

export interface CodeReviewTurn {
  finalResponse: string;
}

export interface CodeReviewThread {
  run(prompt: string, options: CodeReviewRunOptions): Promise<CodeReviewTurn>;
}

export interface CodeReviewThreadOptions {
  model?: string;
  sandboxMode: "read-only";
  approvalPolicy: "on-request";
}

/** Minimal Codex client surface required by the buffered reviewer. */
export interface CodeReviewRunner {
  startThread(options: CodeReviewThreadOptions): CodeReviewThread;
}
