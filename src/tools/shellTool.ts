import { resolve, relative, isAbsolute, sep } from "node:path";
import { stat, realpath } from "node:fs/promises";
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
          path:{
            type:"string"
          }
            
        },
        required: ["command", "args","path"],
    },

    async execute(args: Record<string, unknown>): Promise<string> {
        const command = args.command;
        const commandArgs = args.args;
        const commandPath=args.path

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
if (
    commandPath !== undefined &&
    (typeof commandPath !== "string" || commandPath.trim() === "")
) {
    return "Error: path must be a non-empty relative directory path.";
}

if (commandPath && isAbsolute(commandPath)) {
    return "Error: Absolute paths are not allowed.";
}

const workspaceRoot = await realpath(process.cwd());

const requestedPath = resolve(
    workspaceRoot,
    commandPath || ".",
);

const relativePath = relative(workspaceRoot, requestedPath);

if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
) {
    return "Error: Working directory must stay inside the workspace.";
}

try {
    const actualPath = await realpath(requestedPath);
    const actualRelativePath = relative(workspaceRoot, actualPath);

    if (
        actualRelativePath === ".." ||
        actualRelativePath.startsWith(`..${sep}`) ||
        isAbsolute(actualRelativePath)
    ) {
        return "Error: Working directory must stay inside the workspace.";
    }

    if (!(await stat(actualPath)).isDirectory()) {
        return "Error: The specified path is not a directory.";
    }
} catch {
    return "Error: Working directory does not exist or cannot be accessed.";
}
        const approved = await requestApproval(
    ShellTool.name,
    ShellTool.description,
    JSON.stringify({
        command,
        args: commandArgs,
        path: relativePath || ".",
    }),
);

        if (!approved) {
            return "Execution cancelled: approval was denied.";
        }

        try {
           

const isWindows = process.platform === "win32";

let executable = command;
let executableArgs = commandArgs;

if (isWindows && command === "npm") {
    executable = process.execPath;
    executableArgs = [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        ...commandArgs,
    ];
} else if (isWindows && command === "npx") {
    executable = process.execPath;
    executableArgs = [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js",
        ...commandArgs,
    ];
}



const { stdout, stderr } = await execFileAsync(
    executable,
    executableArgs,
    {
        cwd: requestedPath,
        timeout: 120_000,
        maxBuffer: 5 * 1024 * 1024,
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
