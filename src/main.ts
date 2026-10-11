import { Message } from "./types.js";
import { tools } from "./tools/index.js";
import { groqProvider,groq } from "./provider/groq.js";
import { runAgent } from "./agent/agent.js";


const messages: Message[] = [];

async function main(prompt: string): Promise<void> {

    messages.push({
        role: "user",
        content: prompt,
    });

    await runAgent(
        groqProvider,
        messages,
        tools
        ,(event)=>{
       if (event.type === "text") {
        process.stdout.write(event.content);
    }

    if (event.type === "tool_call") {
        console.log(`\n[TOOL: ${event.name}]`);
    }

    if (event.type === "tool_result") {
        console.log(`[RESULT]\n${event.result}`);
    }
    if (event.type === "error") {
       console.error(`\n[ERROR] ${event.message}`);
        return 0
    }
    if(event.type=="done")
    {
        console.log("end");
    }
        }
    );
}
await main(
    `Use the edit tool to replace the exact text hello with hello edited in test.js. Do not use the shell tool. Do not tell me to edit the file manually."`
);


console.log("\n---");