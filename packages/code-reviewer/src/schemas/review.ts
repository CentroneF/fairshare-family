import { z } from "zod";

const scoreSchema = z
  .number()
  .int()
  .min(1)
  .max(10)
  .describe("Score from 1 (serious gaps) through 10 (exemplary)");

export const reviewSchema = z.object({
  implementationCorrectness: scoreSchema.describe("Whether the code does what it declares"),
  idiomaticity: scoreSchema.describe("Conformance with language and project conventions"),
  complexity: scoreSchema.describe("Simplicity relative to the problem"),
  testRiskCoverage: scoreSchema.describe("Test coverage proportional to changed-path risk"),
  securitySafety: scoreSchema.describe("Absence of vulnerabilities and secret leaks"),
  verdict: z.enum(["pass", "fail"]).describe("Binding verdict for the whole change"),
  summary: z.string().describe("Actionable PR-comment summary in Markdown"),
});

export const reviewJsonSchema = z.toJSONSchema(reviewSchema);

export type Review = z.infer<typeof reviewSchema>;

export type ReviewRequest = {
  diff: string;
};
