import { z } from "zod";

export const scoreRubric = {
  implementationCorrectness: {
    label: "Implementation correctness",
    grade1: "Logic is broken, misses obvious edge/error cases, or silently regresses existing behavior.",
    grade10: "Works across happy paths, edge cases, and failure modes without regressions.",
  },
  idiomaticity: {
    label: "Idiomaticity",
    grade1: "Fights the stack and repository patterns; reads as foreign.",
    grade10: "Matches well-written surrounding code and uses the right idioms naturally.",
  },
  complexity: {
    label: "Complexity",
    grade1: "Is over-engineered or tangled, with accidental complexity that obscures intent.",
    grade10: "Is the minimal, clear design that completely solves the problem.",
  },
  testRiskCoverage: {
    label: "Test/risk coverage",
    grade1: "Risky logic is untested, or tests are absent, trivial, or unhelpful.",
    grade10: "Tests the paths most likely to break deliberately and in proportion to risk.",
  },
  documentation: {
    label: "Documentation",
    grade1: "Leaves needed intent opaque, forcing readers to reverse-engineer it.",
    grade10: "Explains the why behind non-obvious decisions without restating the obvious.",
  },
  securitySafety: {
    label: "Security/safety",
    grade1: "Introduces an exploitable flaw, leaks secrets, or unsafely trusts untrusted input.",
    grade10: "Validates input, handles secrets correctly, and opens no new attack surface.",
  },
} as const;

function scoreSchema(criterion: keyof typeof scoreRubric) {
  const { grade1, grade10 } = scoreRubric[criterion];
  return z.number().int().min(1).max(10).describe(`Grade 1: ${grade1} Grade 10: ${grade10}`);
}

export const reviewSchema = z.object({
  implementationCorrectness: scoreSchema("implementationCorrectness"),
  idiomaticity: scoreSchema("idiomaticity"),
  complexity: scoreSchema("complexity"),
  testRiskCoverage: scoreSchema("testRiskCoverage"),
  documentation: scoreSchema("documentation"),
  securitySafety: scoreSchema("securitySafety"),
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
