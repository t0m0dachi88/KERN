import dotenv from "dotenv";

import Groq from "groq-sdk";

import { } from "groq-sdk";

import { Message } from "./types.js"

import { readTool } from "./tools/readTool.js";

// RULE: dotenv.config() must run BEFORE any code that reads process.env
// It reads your .env file and puts the values into process.env
dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, // reads from .env
});

const messages: Message[] = [];

async function main(prompt: string): Promise<void> {

    messages.push({ role: "user", content: prompt });

    let fullresponse = ""

    const stream = await groq.chat.completions.create({
        messages: messages,

        tools: [
            {
                type: "function",
                function: {
                    name: readTool.name,
                    description: readTool.description,
                    parameters: readTool.parameters
                }
            }
        ],

        model: "openai/gpt-oss-20b",
        stream: true // if i wanna stream data i have to add this key
    });

    let toolCallName = "";
    let toolCallArgs = "";
    let toolCallId = "";

    for await (const chunk of stream) {

        const delta = chunk.choices[0]?.delta

        if (delta?.content) {

            process.stdout.write(delta.content);

            fullresponse += delta.content
        }

        if (delta?.tool_calls) {

            const tc = delta.tool_calls[0];

            if (tc?.id) toolCallId = tc.id;

            if (tc?.function?.name)
                toolCallName = tc.function.name;

            if (tc?.function?.arguments)
                toolCallArgs += tc.function.arguments;
        }
    }

    // Did the LLM ask for a tool?
    if (toolCallName === "read") {

        // Tell the conversation history that the assistant requested a tool
        messages.push({
            role: "assistant",
            content: null,
            tool_calls: [{
                id: toolCallId,
                type: "function",
                function: {
                    name: toolCallName,
                    arguments: toolCallArgs
                }
            }]
        } as any);

        console.log(`\n\n[EXECUTING TOOL: ${toolCallName}]`);

        // 1. Parse the JSON arguments the LLM sent
        const parsedArgs = JSON.parse(toolCallArgs);

        // 2. Actually execute your tool!
        const toolResult = await readTool.execute(parsedArgs);

        // 3. Give the tool result back to the conversation
        messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: toolResult
        });

        console.log(`[TOOL RESULT]:\n${toolResult}`);

        // 4. Ask the LLM to understand/summarize the tool result
        console.log(`\n\n[ASKING LLM TO SUMMARIZE THE RESULT...]\n`);

        const stream2 = await groq.chat.completions.create({

            messages: messages,

            model: "openai/gpt-oss-20b",

            stream: true
        });

        let finalResponse = "";

        for await (const chunk of stream2) {

            const content = chunk.choices[0]?.delta?.content;

            if (content) {

                process.stdout.write(content);

                finalResponse += content;
            }
        }

        // Save the final LLM response to conversation history
        messages.push({
            role: "assistant",
            content: finalResponse
        });
    }

    else {

        // If the LLM didn't use a tool,
        // save its response normally.
        messages.push({
            role: "assistant",
            content: fullresponse
        });
    }
}

await main("What are the contents of the package.json file?");

console.log("\n---");