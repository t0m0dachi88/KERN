
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import {
  Message,
  Tool,
  LLMProvider,
  LLMChunk,
  LLMToolCall,
} from "../types.js";

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from .env");
}

const ai = new GoogleGenAI({ apiKey });

const MODEL = "gemma-4-31b-it";

// Translate Kern's OpenAI-compatible message history
// into Google's Content format.
function convertMessages(messages: Message[]) {
  const toolNames = new Map<string, string>();

  return messages.map((message) => {
    // Assistant messages may contain tool calls.
    if (message.role === "assistant") {
      const parts: any[] = [];

      if (message.content) {
        parts.push({ text: message.content });
      }

      for (const call of message.tool_calls ?? []) {
        const fn = call.function;

        toolNames.set(call.id, fn.name);

        parts.push({
          functionCall: {
            name: fn.name,
            args: JSON.parse(fn.arguments),
            id: call.id,
          },
        });
      }

      return {
        role: "model" as const,
        parts: parts.length ? parts : [{ text: "" }],
      };
    }

    // Tool results become function responses.
    if (message.role === "tool") {
      const name = toolNames.get(message.tool_call_id);

      if (!name) {
        throw new Error(
          `Cannot find function name for tool call: ${message.tool_call_id}`,
        );
      }

      let result: unknown = message.content;

      try {
        result = JSON.parse(message.content);
      } catch {
        // Keep ordinary text results as strings.
      }

      return {
        role: "user" as const,
        parts: [
          {
            functionResponse: {
              name,
              response: { result },
              id: message.tool_call_id,
            },
          },
        ],
      };
    }

    // Ordinary user messages.
    return {
      role: "user" as const,
      parts: [{ text: message.content ?? "" }],
    };
  });
}

export const gemmaProvider: LLMProvider = {
  async *generateResponse(
    messages: Message[],
    tools: Tool[],
  ): AsyncGenerator<LLMChunk> {
    const contents = convertMessages(messages);

    const functionDeclarations = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.parameters,
    }));

    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        ...(functionDeclarations.length > 0
          ? {
              tools: [{ functionDeclarations }],
            }
          : {}),
      },
    });

    const toolCalls = new Map<string, LLMToolCall>();

    for await (const chunk of stream) {
      if (chunk.text) {
        yield { content: chunk.text };
      }

      for (const [index, call] of (
        chunk.functionCalls ?? []
      ).entries()) {
        const id = call.id ?? `gemma-${index}`;

        toolCalls.set(id, {
          id,
          name: call.name,
          arguments: JSON.stringify(call.args ?? {}),
        });
      }
    }

    if (toolCalls.size > 0) {
      yield { toolCalls: [...toolCalls.values()] };
    }
  },
};
