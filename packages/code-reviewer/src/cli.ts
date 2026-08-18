import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { review } from "./index.js";
import { reviewRequestSchema, type Review, type ReviewRequest } from "./schemas/review.js";

/** Command-line adapter; the reusable API lives in index.ts. */
export async function readReviewRequest(args: string[]): Promise<ReviewRequest> {
  const { values } = parseArgs({ args, options: { request: { type: "string" } } });
  if (!values.request) throw new Error("Missing required --request <path> argument");

  const source = await readFile(values.request, "utf8");
  return reviewRequestSchema.parse(JSON.parse(source));
}

export interface CliOutput {
  write(chunk: string): unknown;
}

export function formatCliError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  return cause instanceof Error && cause.message ? `${error.message}: ${cause.message}` : error.message;
}

export async function main(
  args = process.argv.slice(2),
  reviewer: (request: ReviewRequest) => Promise<Review> = review,
  stdout: CliOutput = process.stdout,
  stderr: CliOutput = process.stderr,
): Promise<void> {
  stderr.write("[code-reviewer] reading review request\n");
  const request = await readReviewRequest(args);
  stderr.write("[code-reviewer] request received; starting review\n");

  const result = await reviewer(request);
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(resolve(entrypoint)).href) {
  main().catch((error: unknown) => {
    const message = formatCliError(error);
    // eslint-disable-next-line no-console -- the CLI contract sends failures to stderr.
    console.error(`[code-reviewer] review failed: ${message}`);
    process.exitCode = 1;
  });
}
