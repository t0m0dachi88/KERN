import { Message } from "./types.js";
import { readTool } from "./tools/readTool.js";
import { groq } from "./provider/groq.js";
import { runAgent } from "./agent/agent.js";

const messages: Message[] = [];

async function main(prompt: string): Promise<void> {

    messages.push({
        role: "user",
        content: prompt,
    });

    await runAgent(
        groq,
        messages,
        [readTool]
    );
}

await main(
    "What are the contents of the src/types.ts file?"
);



console.log("\n---");