import type {  LLMProvider,
    LLMToolCall,
    Message,
    Tool,
    EventHandler,} from "../types.js";

const MAX_TURNS = 10;


function validateToolCallBatch(
    toolCalls: LLMToolCall[]
): string | null {
    const seenIds = new Set<string>();

    for (const call of toolCalls) {
        if (!call.id?.trim()) {
            return "Tool call is missing an ID.";
        }

        if (!call.name?.trim()) {
            return `Tool call ${call.id} is missing a function name.`;
        }

        if (seenIds.has(call.id)) {
            return `Duplicate tool-call ID: ${call.id}`;
        }

        seenIds.add(call.id);

        if (typeof call.arguments !== "string") {
            return `Tool call ${call.id} has invalid arguments.`;
        }

        try {
            const parsed: unknown = JSON.parse(call.arguments);

            if (
                parsed === null ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {
                return `Tool call ${call.id} arguments must be a JSON object.`;
            }
        } catch {
            return `Tool call ${call.id} contains malformed JSON arguments.`;
        }
    }

    return null;
}



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
//const recentMessages = messages.slice(-10);

// const stream = await provider.generateResponse(
//     messages,
//     tools
// );
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
    console.error("Full LLM error:", error);

    onEvent({
        type: "error",
        message: `LLM error: ${
            error instanceof Error ? error.message : String(error)
        }`,
    });
    onEvent({ type: "done", status: "error" });
    return;
}

        // No tool calls means the model has finished its response.
        if (toolCalls.length === 0) {
            messages.push({
                role: "assistant",
                content: fullResponse,
            });

           onEvent({ type: "done", status: "success" });
return;
        }
        const validationError = validateToolCallBatch(toolCalls);

if (validationError) {
    onEvent({
        type: "error",
        message: validationError,
    });
    onEvent({ type: "done", status: "error" });
    return;
}

        // Record the assistant's tool-call request in conversation history.
        
const assistantToolCallMessage: Message = {
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
};

messages.push(assistantToolCallMessage);

        // Execute each requested tool and return its result.
        
for (const call of toolCalls) {
    const name = call.name?.trim() ?? "";
    const args = call.arguments ?? "";

    onEvent({
        type: "tool_call",
        name: name || "(invalid tool name)",
        arguments: args,
    });

    let result: string;

    if (!call.id?.trim()) {
        result = "Tool error: Missing tool-call ID.";
    } else if (!name) {
        result = "Tool error: Missing tool name.";
    } else {
        const tool = tools.find((item) => item.name === name);

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
                result = `Tool error: ${
                    error instanceof Error
                        ? error.message
                        : String(error)
                }`;
            }
        }
    }
            onEvent({
                type: "tool_result",
                name,
                result,
            });

           
const toolResultMessage: Message = {
    role: "tool",
    tool_call_id: call.id,
    content: result,
};

messages.push(toolResultMessage);
        }
    }

    onEvent({
        type: "error",
        message: `Agent reached the maximum of ${MAX_TURNS} turns.`,
    });
   onEvent({ type: "done", status: "error" });
return;;
}