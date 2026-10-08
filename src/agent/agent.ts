import Groq from "groq-sdk";
import { Message, Tool } from "../types.js";

const MAX_TURNS = 10;

export async function runAgent(
    groq: Groq,
    messages: Message[],
    tools: Tool[]
): Promise<void> {

    for (let turn = 0; turn < MAX_TURNS; turn++) {

        let fullResponse = "";

        const stream = await groq.chat.completions.create({
            messages: messages as any,
            tools: tools.map((tool) => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            })),
            model: "openai/gpt-oss-20b",
            stream: true,
        });

        let toolCallName = "";
        let toolCallArgs = "";
        let toolCallId = "";

        for await (const chunk of stream) {

            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
                process.stdout.write(delta.content);
                fullResponse += delta.content;
            }

            if (delta?.tool_calls) {

                const tc = delta.tool_calls[0];

                if (tc?.id) {
                    toolCallId = tc.id;
                }

                if (tc?.function?.name) {
                    toolCallName = tc.function.name;
                }

                if (tc?.function?.arguments) {
                    toolCallArgs += tc.function.arguments;
                }
            }
        }

        // No tool requested → final response
        if (!toolCallName) {

            messages.push({
                role: "assistant",
                content: fullResponse,
            });

            return;
        }

        // Model requested a tool
        messages.push({
            role: "assistant",
            content: null,
            tool_calls: [
                {
                    id: toolCallId,
                    type: "function",
                    function: {
                        name: toolCallName,
                        arguments: toolCallArgs,
                    },
                },
            ],
        } as any);

        // Find the requested tool
        const tool = tools.find(
            (tool) => tool.name === toolCallName
        );

        if (!tool) {

            messages.push({
                role: "tool",
                tool_call_id: toolCallId,
                content: `Unknown tool: ${toolCallName}`,
            } as any);

            continue;
        }

        console.log(`\n\n[EXECUTING TOOL: ${toolCallName}]`);

        const parsedArgs = JSON.parse(toolCallArgs);

        const toolResult = await tool.execute(parsedArgs);

        console.log(`[TOOL RESULT]:\n${toolResult}`);

        // Give result back to model
        messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: toolResult,
        } as any);

        console.log(
            "\n\n[ASKING LLM TO CONTINUE...]\n"
        );

        // Loop automatically goes back to the model.
    }

    console.log(
        "\n[AGENT STOPPED: maximum number of turns reached]"
    );
}