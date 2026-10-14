
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Tool } from "../types.js";
import { isCommandAllowed } from "./commandAllowList.js";
import { requestApproval } from "./approval.js";

const execFileAsync = promisify(execFile);

export const ShellTool: Tool = {
    name: "shell",
    description:
        "Runs an allow-listed program with an array of arguments. " +
        "Use node index.js to run a JavaScript file or npm run <script> " +
        "to run a project script.",

    parameters: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "Executable name, such as node or npm",
            },
            args: {
                type: "array",
                items: { type: "string" },
                description: "Arguments passed to the executable",
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
            return (
                "Error: Invalid arguments. Expected a non-empty command " +
                "and an array of string arguments."
            );
        }

        if (!isCommandAllowed(command, commandArgs)) {
            return (
                `Error: Command or arguments are not allowed: ` +
                `${JSON.stringify({ command, args: commandArgs })}`
            );
        }

        const approved = await requestApproval(
            ShellTool.name,
            ShellTool.description,
            JSON.stringify({ command, args: commandArgs }),
        );

        if (!approved) {
            return "Execution cancelled: approval was denied.";
        }

        try {
            const { stdout, stderr } = await execFileAsync(
                command,
                commandArgs,
                {
                    cwd: process.cwd(),
                    timeout: 30_000,
                    maxBuffer: 1024 * 1024,
                    windowsHide: true,
                    shell: false,
                },
            );

            return [
                "Exit code: 0",
                `stdout:\n${stdout || "(empty)"}`,
                `stderr:\n${stderr || "(empty)"}`,
            ].join("\n\n");
        } catch (error: unknown) {
            const processError = error as {
                message?: string;
                stdout?: string;
                stderr?: string;
                code?: string | number;
                signal?: string;
            };

            return [
                `Execution failed: ${processError.message ?? "Unknown error"}`,
                `Exit code: ${processError.code ?? "unknown"}`,
                `Signal: ${processError.signal ?? "none"}`,
                `stdout:\n${processError.stdout || "(empty)"}`,
                `stderr:\n${processError.stderr || "(empty)"}`,
            ].join("\n\n");
        }
    },
};
