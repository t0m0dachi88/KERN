
import dotenv from "dotenv";

import {
  Message,
  Tool,
  LLMProvider,
  LLMChunk,
  LLMToolCall,
} from "../types.js";

dotenv.config();

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b";

interface StreamToolCall {
  id: string;
  name: string;
  arguments: string;
}

export const openRouterProvider: LLMProvider = {
  async *generateResponse(
    messages: Message[],
    tools: Tool[],
  ): AsyncGenerator<LLMChunk> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is missing from .env");
    }

    const requestBody = {
      model: MODEL,
      messages,
      stream: true,
      ...(tools.length > 0
        ? {
            tools: tools.map((tool) => ({
              type: "function" as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
          }
        : {}),
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `OpenRouter API error (${response.status}): ${errorBody}`,
      );
    }

    if (!response.body) {
      throw new Error("OpenRouter returned an empty response stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const toolCalls = new Map<number, StreamToolCall>();

    let buffer = "";
    let streamFinished = false;

    const processLine = (line: string): LLMChunk | undefined => {
      const trimmed = line.trim();

      if (!trimmed.startsWith("data:")) {
        return undefined;
      }

      const data = trimmed.slice(5).trim();

      if (!data || data === "[DONE]") {
        if (data === "[DONE]") {
          streamFinished = true;
        }
        return undefined;
      }

      let chunk: any;

      try {
        chunk = JSON.parse(data);
      } catch {
        throw new Error("OpenRouter returned malformed SSE JSON");
      }

      if (chunk.error) {
        throw new Error(
          `OpenRouter stream error: ${JSON.stringify(chunk.error)}`,
        );
      }

      const delta = chunk.choices?.[0]?.delta;

      if (typeof delta?.content === "string" && delta.content.length > 0) {
        return { content: delta.content };
      }

      for (const call of delta?.tool_calls ?? []) {
        const index = call.index;

        if (typeof index !== "number") {
          throw new Error(
            "OpenRouter returned a tool call without an index",
          );
        }

        const existing = toolCalls.get(index) ?? {
          id: "",
          name: "",
          arguments: "",
        };

        if (call.id) {
          existing.id = call.id;
        }

        if (call.function?.name) {
          existing.name += call.function.name;
        }

        if (typeof call.function?.arguments === "string") {
          existing.arguments += call.function.arguments;
        }

        toolCalls.set(index, existing);
      }

      return undefined;
    };

    try {
      while (!streamFinished) {
        const { value, done } = await reader.read();

        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const result = processLine(line.replace(/\r$/, ""));

          if (result) {
            yield result;
          }

          if (streamFinished) {
            break;
          }
        }
      }

      // Process a final unterminated line, if present.
      if (!streamFinished && buffer.trim()) {
        const result = processLine(buffer);

        if (result) {
          yield result;
        }
      }

      if (toolCalls.size > 0) {
        const completeCalls: LLMToolCall[] = [...toolCalls.entries()]
          .sort(([a], [b]) => a - b)
          .map(([index, call]) => {
            if (!call.id || !call.name) {
              throw new Error(
                `OpenRouter returned an incomplete tool call at index ${index}`,
              );
            }

            // Validate the completed JSON, not individual stream fragments.
            JSON.parse(call.arguments || "{}");

            return {
              id: call.id,
              name: call.name,
              arguments: call.arguments || "{}",
            };
          });

        yield { toolCalls: completeCalls };
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  },
};
