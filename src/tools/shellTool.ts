
import { Tool } from "../types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const ShellTool: Tool = {
    name: "shell",
    description: "Executes a program with the specified arguments.",

    parameters: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "The executable program to run, such as node or npm",
            },
            args: {
                type: "array",
                items: {
                    type: "string",
                },
                description: "Arguments to pass to the executable",
            },
        },
        required: ["command", "args"],
    },

    async execute(args: Record<string, unknown>): Promise<string> {
    const command = args.command;
    const commandArgs = args.args;

    if (
        typeof command !== "string" ||
        command.trim() === "" ||
        !Array.isArray(commandArgs) ||
        !commandArgs.every((arg) => typeof arg === "string")
    ) {
        return "Invalid arguments: expected a command string and an array of string arguments.";
    }

    try {
        const { stdout, stderr } = await execFileAsync(
            command,
            commandArgs,{
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
}
        );

        return [
            `Exit code: 0`,
            `stdout:\n${stdout || "(empty)"}`,
            `stderr:\n${stderr || "(empty)"}`,
        ].join("\n\n");
    } catch (error: unknown) {
        const processError = error as {
            message?: string;
            stdout?: string;
            stderr?: string;
            code?: string | number;
        };

        return [
            `Execution failed: ${processError.message ?? "Unknown error"}`,
            `Exit code: ${processError.code ?? "unknown"}`,
            `stdout:\n${processError.stdout || "(empty)"}`,
            `stderr:\n${processError.stderr || "(empty)"}`,
        ].join("\n\n");
    }
},
};