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
