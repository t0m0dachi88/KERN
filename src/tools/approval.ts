import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function requestApproval(toolName:string, description:string, args?:string) {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log(`Tool: ${toolName}`);
    console.log(`Proposed action: ${description}`);
    if (args !== undefined) {
      console.log(`Arguments: ${args}`);
    }

    const answer = await rl.question("Approve this action? (y/n): ");

    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}