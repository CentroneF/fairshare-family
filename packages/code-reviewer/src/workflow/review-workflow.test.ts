import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflowPath = resolve(process.cwd(), "../../.github/workflows/ai-code-review.yml");

async function readWorkflow() {
  return readFile(workflowPath, "utf8");
}

describe("AI review workflow contract", () => {
  it("limits review execution to opened or retry-labelled same-repository PRs", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("types: [opened, reopened, synchronize, labeled]");
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("github.event.label.name == 'ai-cr:review'");
    expect(workflow).toContain("cancel-in-progress: true");
  });

  it("uses the trusted base checkout and publishes idempotent advisory feedback", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain("ref: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("pull-request-number: ${{ github.event.pull_request.number }}");
    expect(workflow).toContain("uses: ./.github/actions/publish-ai-review");
    const reviewerAction = await readFile(
      resolve(process.cwd(), "../../.github/actions/ai-reviewer/action.yml"),
      "utf8",
    );
    expect(reviewerAction).toContain("CODEX_MODEL: ${{ inputs.model }}");
    expect(reviewerAction).toContain("default: gpt-5.6-sol");
    expect(reviewerAction).toContain("const request = { title: metadata.title, diff: diff.data };");
    expect(reviewerAction).toContain("if (metadata.body?.trim()) request.body = metadata.body;");
    const action = await readFile(resolve(process.cwd(), "../../.github/actions/publish-ai-review/action.yml"), "utf8");
    expect(action).toContain("<!-- ai-code-review -->");
    expect(action).toContain("issues.updateComment");
    expect(action).toContain("issues.createComment");
    expect(action).toContain("issues.addLabels");
    expect(action).toContain("issues.removeLabel");
    expect(action).toContain('process.env.VERDICT === "pass"');
  });
});
