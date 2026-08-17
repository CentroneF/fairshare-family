import { z } from "zod";

const scoreSchema = z.number().int().min(1).max(10).describe("Score from 1 (serious gaps) through 10 (exemplary)");

export const reviewSchema = z.object({
  implementationCorrectness: scoreSchema.describe("Whether the code does what it declares"),
  idiomaticity: scoreSchema.describe("Conformance with language and project conventions"),
  complexity: scoreSchema.describe("Simplicity relative to the problem"),
  testRiskCoverage: scoreSchema.describe("Test coverage proportional to changed-path risk"),
  documentation: scoreSchema.describe("Documentation of non-obvious decisions and public surfaces"),
  securitySafety: scoreSchema.describe("Absence of vulnerabilities and secret leaks"),
  verdict: z.enum(["pass", "fail"]).describe("Binding verdict for the whole change"),
  summary: z.string().describe("Actionable PR-comment summary in Markdown"),
});

export const reviewJsonSchema = z.toJSONSchema(reviewSchema);

export type Review = z.infer<typeof reviewSchema>;

export const reviewRequestSchema = z.object({
  title: z.string().trim().min(1).describe("Pull request title"),
  body: z.string().trim().min(1).optional().describe("Optional non-empty pull request description"),
  diff: z.string().describe("Base-to-head pull request diff"),
});

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
