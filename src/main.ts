import { Message } from "./types.js";
import { tools } from "./tools/index.js";
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
        tools
    );
}

await main(
    "List the files in src and also in its sub folders"
);


console.log("\n---");