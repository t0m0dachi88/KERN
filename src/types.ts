export type Message = {
    role: "user" | "assistant", content: string
}

export interface ToolSpec {
    name: string;
    description: string;
    parameters: Object
}
export interface Tool extends ToolSpec {
    execute: (args: Record<string, unknown>) => Promise<string>
}
