import { describe, expect, it } from "vitest";

import { reviewJsonSchema, reviewRequestSchema, reviewSchema, scoreRubric } from "./review.js";

const validReview = {
  implementationCorrectness: 1,
  idiomaticity: 10,
  complexity: 5,
  testRiskCoverage: 6,
  documentation: 7,
  securitySafety: 8,
  verdict: "pass",
  summary: "Useful summary.",
};

describe("review schemas", () => {
  it("requires six integer scores from one through ten", () => {
    expect(reviewSchema.parse(validReview)).toEqual(validReview);
    expect(reviewSchema.safeParse({ ...validReview, documentation: undefined }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...validReview, documentation: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...validReview, documentation: 11 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...validReview, documentation: 7.5 }).success).toBe(false);
  });

  it("requires a title and diff while accepting only a non-empty optional body", () => {
    expect(reviewRequestSchema.parse({ title: "Review me", diff: "diff --git a b" })).toEqual({
      title: "Review me",
      diff: "diff --git a b",
    });
    expect(reviewRequestSchema.safeParse({ diff: "diff" }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ title: "Review me", diff: "diff", body: "" }).success).toBe(false);
  });

  it("marks documentation as required in the generated JSON schema", () => {
    expect(reviewJsonSchema).toMatchObject({
      properties: { documentation: { minimum: 1, maximum: 10 } },
      required: [
        "implementationCorrectness",
        "idiomaticity",
        "complexity",
        "testRiskCoverage",
        "documentation",
        "securitySafety",
        "verdict",
        "summary",
      ],
    });
  });

  it("includes criterion-specific grade-one and grade-ten anchors in the JSON schema", () => {
    for (const [criterion, { grade1, grade10 }] of Object.entries(scoreRubric)) {
      expect(reviewJsonSchema).toMatchObject({
        properties: {
          [criterion]: {
            description: `Grade 1: ${grade1} Grade 10: ${grade10}`,
          },
        },
      });
    }
  });
});
