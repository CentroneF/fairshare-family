import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { main, readReviewRequest } from "./cli.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function requestPath(request: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "code-reviewer-"));
  directories.push(directory);
  const path = join(directory, "request.json");
  await writeFile(path, JSON.stringify(request));
  return path;
}

describe("CLI", () => {
  it("reads a structured request and writes review JSON while keeping diagnostics separate", async () => {
    const path = await requestPath({ title: "Review", diff: "diff --git a b" });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const result = {
      implementationCorrectness: 7,
      idiomaticity: 7,
      complexity: 7,
      testRiskCoverage: 7,
      documentation: 7,
      securitySafety: 7,
      verdict: "pass" as const,
      summary: "Looks good.",
    };

    const reviewer = vi.fn(async () => result);
    await main(["--request", path], reviewer, { write: (chunk) => stdout.push(chunk) }, { write: (chunk) => stderr.push(chunk) });

    expect(JSON.parse(stdout.join(""))).toEqual(result);
    expect(stderr.join("")).toContain("reading review request");
    expect(reviewer).toHaveBeenCalledWith({ title: "Review", diff: "diff --git a b" });
  });

  it("forwards a non-empty pull request body", async () => {
    const path = await requestPath({ title: "Review", body: "Context", diff: "diff --git a b" });
    const reviewer = vi.fn(async () => ({
      implementationCorrectness: 7,
      idiomaticity: 7,
      complexity: 7,
      testRiskCoverage: 7,
      documentation: 7,
      securitySafety: 7,
      verdict: "pass" as const,
      summary: "Looks good.",
    }));

    await main(["--request", path], reviewer, { write: () => undefined }, { write: () => undefined });

    expect(reviewer).toHaveBeenCalledWith({ title: "Review", body: "Context", diff: "diff --git a b" });
  });

  it("rejects a request without the required title", async () => {
    const path = await requestPath({ diff: "diff --git a b" });

    await expect(readReviewRequest(["--request", path])).rejects.toThrow();
  });
});
