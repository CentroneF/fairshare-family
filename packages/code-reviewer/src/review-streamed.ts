import "dotenv/config";
import { Codex } from "@openai/codex-sdk";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a precise, constructive code reviewer evaluating a pull request.
Assess the given diff against five criteria on a scale of 1-10 (1 = serious gaps, 10 = exemplary):
implementation correctness, idiomaticity, complexity, test coverage relative to risk, security.
Then issue a binding verdict (pass/fail) for the whole change and include a short summary (2-3 sentences)
in Markdown, on which the PR author will be able to act.`;

const REVIEW_SCHEMA = z.object({
  implementationCorrectness: z
    .number()
    .describe("Implementation correctness: whether the code does what it declares (scale 1-10)"),
  idiomaticity: z
    .number()
    .describe("Idiomaticity: conformance with the conventions of the language and the project (scale 1-10)"),
  complexity: z.number().describe("Complexity: simplicity of the solution relative to the problem (scale 1-10)"),
  testRiskCoverage: z.number().describe("Test coverage proportional to the risk of the changed paths (scale 1-10)"),
  securitySafety: z.number().describe("Security: no vulnerabilities and no secret leaks (scale 1-10)"),
  verdict: z.enum(["pass", "fail"]).describe("Binding verdict for the whole change"),
  summary: z.string().describe("Summary in Markdown, ready as a comment on the PR"),
});

const REVIEW_JSON_SCHEMA = z.toJSONSchema(REVIEW_SCHEMA);

type Review = z.infer<typeof REVIEW_SCHEMA>;

// Reading arguments from stdin
async function readDiff(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

// Review process based on the git diff
async function review(diff: string): Promise<Review> {
  const codex = new Codex();
  const thread = codex.startThread({
    model: process.env.CODEX_MODEL,
    sandboxMode: "read-only",
    approvalPolicy: "on-request",
  });

  console.error("[codex] review started");
  const { events } = await thread.runStreamed(`${SYSTEM_PROMPT}\n\nReview this diff:\n\n${diff}`, {
    outputSchema: REVIEW_JSON_SCHEMA,
  });

  let finalResponse: string | undefined;
  for await (const event of events) {
    console.error(`[codex:event] ${JSON.stringify(event)}`);

    switch (event.type) {
      case "item.completed":
        if (event.item.type === "agent_message") {
          finalResponse = event.item.text;
        } else if (event.item.type === "command_execution") {
          console.error(`[codex] command: ${event.item.command} (exit ${event.item.exit_code ?? "unknown"})`);
        } else if (event.item.type === "todo_list") {
          console.error(`[codex] plan: ${event.item.items.map((item) => item.text).join("; ")}`);
        } else if (event.item.type === "error") {
          console.error(`[codex] error: ${event.item.message}`);
        }
        break;
      case "turn.completed":
        console.error(`[codex] turn complete: ${event.usage.output_tokens} output tokens`);
        break;
      case "turn.failed":
        throw new Error(`Review failed: ${event.error.message}`);
      case "error":
        throw new Error(`Review failed: ${event.message}`);
    }
  }

  if (!finalResponse) throw new Error("The agent returned no final response");

  let output: unknown;
  try {
    output = JSON.parse(finalResponse);
  } catch (error) {
    throw new Error(`Codex returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const parsed = REVIEW_SCHEMA.safeParse(output);
  if (!parsed.success) throw new Error(`Invalid structured output: ${parsed.error.message}`);
  return parsed.data;
}

// Entry point of the whole process
console.error("[code-reviewer] reading diff from stdin");
const diff = await readDiff();
console.error("[code-reviewer] diff received; starting review");
console.log(JSON.stringify(await review(diff), null, 2));
