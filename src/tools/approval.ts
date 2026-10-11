import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function requestApproval(toolName:string, description:string) {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log(`Tool: ${toolName}`);
    console.log(`Proposed action: ${description}`);

    const answer = await rl.question("Approve this action? (y/n): ");

    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}