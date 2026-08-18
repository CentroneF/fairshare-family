import { describe, expect, it, vi } from "vitest";

import { createCodeReviewer } from "./code-reviewer.js";

const request = { title: "Review title", body: "Review body", diff: "diff --git a b" };
const validReview = {
  implementationCorrectness: 8,
  idiomaticity: 8,
  complexity: 8,
  testRiskCoverage: 8,
  documentation: 8,
  securitySafety: 8,
  verdict: "pass" as const,
  summary: "Looks good.",
};

describe("createCodeReviewer", () => {
  it("passes PR metadata to the runner and returns a six-score review", async () => {
    const run = vi.fn().mockResolvedValue({ finalResponse: JSON.stringify(validReview) });
    const reviewer = createCodeReviewer({ runner: { startThread: vi.fn(() => ({ run })) } });

    await expect(reviewer.review(request)).resolves.toEqual(validReview);
    expect(run.mock.calls[0]?.[0]).toContain("Review title");
    expect(run.mock.calls[0]?.[0]).toContain("Review body");
  });

  it("rejects model output that omits the documentation score", async () => {
    const { documentation: _documentation, ...incompleteReview } = validReview;
    const reviewer = createCodeReviewer({
      runner: {
        startThread: vi.fn(() => ({
          run: vi.fn().mockResolvedValue({ finalResponse: JSON.stringify(incompleteReview) }),
        })),
      },
    });

    await expect(reviewer.review(request)).rejects.toMatchObject({
      context: { stage: "invalid-output" },
    });
  });
});
