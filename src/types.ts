
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export type UserMessage = {
    role: "user";
    content: string;
};

export type AssistantMessage = {
    role: "assistant";
    content: string | null;
    tool_calls?: ToolCall[];
};

export type ToolResultMessage = {
    role: "tool";
    tool_call_id: string;
    content: string;
};

export type Message =
    | UserMessage
    | AssistantMessage
    | ToolResultMessage;

export interface ToolSpec {
    name: string;
    description: string;
    parameters: Record<string, unknown>
}
export interface Tool extends ToolSpec {
    execute: (args: Record<string, unknown>) => Promise<string>
}


export type AgentEvent =
    | {
        type: "text";
        content: string;
    }
    | {
        type: "tool_call";
        name: string;
        arguments: string;
    }
    | {
        type: "tool_result";
        name: string;
        result: string;
    }
    | {
        type: "done";
    }| {
        type: "error";
        message: string;
    };

    export type EventHandler =(event:AgentEvent)=>void


export interface LLMToolCall {
    id: string;
    name?: string;
    arguments?: string;
}

export interface LLMChunk {
    content?: string;
    toolCalls?: LLMToolCall[];
}

    export interface LLMProvider {
    generateResponse(
        messages: Message[],
        tools: Tool[]
    ): AsyncIterable<LLMChunk> | Promise<AsyncIterable<LLMChunk>>;
}