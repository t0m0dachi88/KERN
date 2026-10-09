import type { Message, Tool, EventHandler } from "../types.js";
import { groqResponse } from "../provider/groq.js";

const MAX_TURNS = 10;

export async function runAgent(
    messages: Message[],
    tools: Tool[],
    onEvent: EventHandler
): Promise<void> {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
        let fullResponse = "";
        let toolCallName = "";
        let toolCallArgs = "";
        let toolCallId = "";

        try {
            const stream = await groqResponse(messages, tools);

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;

                if (delta?.content) {
                    fullResponse += delta.content;

                    onEvent({
                        type: "text",
                        content: delta.content,
                    });
                }

                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        if (tc.id) {
                            toolCallId = tc.id;
                        }

                        if (tc.function?.name) {
                            toolCallName = tc.function.name;
                        }

                        if (tc.function?.arguments) {
                            toolCallArgs += tc.function.arguments;
                        }
                    }
                }
            }
        } catch (error) {
            onEvent({
                type: "error",
                message: `LLM error: ${error}`,
            });
            return;
        }

        // No tool requested: return the final response.
        if (!toolCallName) {
            messages.push({
                role: "assistant",
                content: fullResponse,
            });

            onEvent({ type: "done" });
            return;
        }

        // Record the assistant's tool request.
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

        onEvent({
            type: "tool_call",
            name: toolCallName,
            arguments: toolCallArgs,
        });

        const tool = tools.find(
            (item) => item.name === toolCallName
        );

        let toolResult: string;

        if (!tool) {
            toolResult = `Unknown tool: ${toolCallName}`;
        } else {
            try {
                const parsedArgs: unknown = JSON.parse(toolCallArgs);

                if (
                    parsedArgs === null ||
                    typeof parsedArgs !== "object" ||
                    Array.isArray(parsedArgs)
                ) {
                    throw new Error("Tool arguments must be a JSON object.");
                }

                toolResult = await tool.execute(
                    parsedArgs as Record<string, unknown>
                );
            } catch (error) {
                toolResult = `Tool error: ${error}`;
            }
        }

        onEvent({
            type: "tool_result",
            name: toolCallName,
            result: toolResult,
        });

        // Return the tool result to the LLM.
        messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: toolResult,
        } as any);
    }

    onEvent({
        type: "error",
        message: `Agent reached the maximum of ${MAX_TURNS} turns.`,
    });

    onEvent({ type: "done" });
}