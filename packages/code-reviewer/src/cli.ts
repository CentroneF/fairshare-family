import "dotenv/config";
import { review } from "./index.js";

/** Command-line adapter; the reusable API lives in index.ts. */
async function readDiff(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  console.error("[code-reviewer] waiting for a diff on stdin");
  const diff = await readDiff();
  console.error("[code-reviewer] diff received; starting review");

  const result = await review({ diff });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[code-reviewer] review failed: ${message}`);
  process.exitCode = 1;
}
