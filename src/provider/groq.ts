import Groq from "groq-sdk";
import dotenv from "dotenv";

import { Message, Tool,LLMProvider,LLMChunk, LLMToolCall } from "../types.js";
dotenv.config();

 export  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, // reads from .env
});
export const groqProvider: LLMProvider = {
    async *generateResponse(messages: Message[], tools: Tool[]) {
        const stream = await groq.chat.completions.create({
            messages: messages as any,
            tools: tools.map((tool) => ({
                type: "function" as const,
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            })),
            model: "openai/gpt-oss-20b",
            stream: true,
        });

        const toolCalls = new Map<number, LLMToolCall>();

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
                yield { content: delta.content };
            }

            for (const call of delta?.tool_calls ?? []) {
                const index = call.index ?? 0;

                const existing = toolCalls.get(index) ?? {
                    id: "",
                    name: "",
                    arguments: "",
                };

                if (call.id) existing.id = call.id;

                existing.name =
                    (existing.name ?? "") + (call.function?.name ?? "");

                existing.arguments =
                    (existing.arguments ?? "") +
                    (call.function?.arguments ?? "");

                toolCalls.set(index, existing);
            }
        }

        if (toolCalls.size > 0) {
            yield { toolCalls: [...toolCalls.values()] };
        }
    },
};