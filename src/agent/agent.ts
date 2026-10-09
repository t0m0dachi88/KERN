import type {  LLMProvider,
    LLMToolCall,
    Message,
    Tool,
    EventHandler,} from "../types.js";
import { groqProvider } from "../provider/groq.js";

const MAX_TURNS = 10;


export async function runAgent(
    provider: LLMProvider,
    messages: Message[],
    tools: Tool[],
    onEvent: EventHandler
): Promise<void> {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
        let fullResponse = "";
        const toolCalls: LLMToolCall[] = [];

        try {
            const stream =await  provider.generateResponse(messages, tools);

            for await (const chunk of stream) {
                if (chunk.content) {
                    fullResponse += chunk.content;
                    onEvent({
                        type: "text",
                        content: chunk.content,
                    });
                }

                if (chunk.toolCalls) {
                    toolCalls.push(...chunk.toolCalls);
                }
            }
        } catch (error) {
            onEvent({
                type: "error",
                message: `LLM error: ${error}`,
            });
            onEvent({ type: "done" });
            return;
        }

        // No tool calls means the model has finished its response.
        if (toolCalls.length === 0) {
            messages.push({
                role: "assistant",
                content: fullResponse,
            });

            onEvent({ type: "done" });
            return;
        }

        // Record the assistant's tool-call request in conversation history.
        messages.push({
            role: "assistant",
            content: fullResponse || null,
            tool_calls: toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: {
                    name: call.name ?? "",
                    arguments: call.arguments ?? "",
                },
            })),
        } as any);

        // Execute each requested tool and return its result.
        for (const call of toolCalls) {
            const name = call.name ?? "";
            const args = call.arguments ?? "{}";

            onEvent({
                type: "tool_call",
                name,
                arguments: args,
            });

            const tool = tools.find((item) => item.name === name);
            let result: string;

            if (!tool) {
                result = `Unknown tool: ${name}`;
            } else {
                try {
                    const parsed: unknown = JSON.parse(args);

                    if (
                        parsed === null ||
                        typeof parsed !== "object" ||
                        Array.isArray(parsed)
                    ) {
                        throw new Error(
                            "Tool arguments must be a JSON object."
                        );
                    }

                    result = await tool.execute(
                        parsed as Record<string, unknown>
                    );
                } catch (error) {
                    result = `Tool error: ${error}`;
                }
            }

            onEvent({
                type: "tool_result",
                name,
                result,
            });

            messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: result,
            } as any);
        }
    }

    onEvent({
        type: "error",
        message: `Agent reached the maximum of ${MAX_TURNS} turns.`,
    });
    onEvent({ type: "done" });
}