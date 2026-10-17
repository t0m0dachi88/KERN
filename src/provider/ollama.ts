
import ollama from "ollama";
import dotenv from "dotenv";

import {
  Message,
  Tool,
  LLMProvider,
  LLMChunk,
  LLMToolCall,
} from "../types.js";

dotenv.config();

const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b ";

function convertMessages(messages: Message[]) {
  const toolNames = new Map<string, string>();

  return messages.map((message) => {
    if (message.role === "assistant") {
      const toolCalls = (message.tool_calls ?? []).map((call) => {
        const name = call.function.name;
        const id = call.id;

        toolNames.set(id, name);

        let args: Record<string, unknown>;

        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          throw new Error(`Invalid arguments for tool: ${name}`);
        }

        return {
          function: { name, arguments: args },
        };
      });

      return {
        role: "assistant",
        content: message.content ?? "",
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };
    }

    if (message.role === "tool") {
      const name = toolNames.get(message.tool_call_id);

      if (!name) {
        throw new Error(
          `Unknown tool call ID: ${message.tool_call_id}`,
        );
      }

      return {
        role: "tool",
        tool_name: name,
        content: message.content ?? "",
      };
    }

    return {
      role: "user",
      content: message.content ?? "",
    };
  });
}

export const ollamaProvider: LLMProvider = {
  async *generateResponse(
    messages: Message[],
    tools: Tool[],
  ): AsyncGenerator<LLMChunk> {
    const stream = await ollama.chat({
      model: MODEL,
      messages: convertMessages(messages) as any,
      tools: tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      stream: true,
      think: false,
    });

    const toolCalls = new Map<string, LLMToolCall>();
    let callIndex = 0;

    for await (const chunk of stream) {
      if (chunk.message.content) {
        yield { content: chunk.message.content };
      }

      for (const call of chunk.message.tool_calls ?? []) {
        const id = `ollama-${callIndex++}`;

        toolCalls.set(id, {
          id,
          name: call.function.name,
          arguments: JSON.stringify(call.function.arguments),
        });
      }
    }

    if (toolCalls.size > 0) {
      yield { toolCalls: [...toolCalls.values()] };
    }
  },
};
