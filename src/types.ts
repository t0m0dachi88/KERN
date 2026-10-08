export type Message = {
    role: "user" | "assistant" |"tool", content: string
}

export interface ToolSpec {
    name: string;
    description: string;
    parameters: Object
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