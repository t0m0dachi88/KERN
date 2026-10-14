
type CommandRule = {
    command: string;
    args: string[];
};

const exactRules: CommandRule[] = [
    { command: "node", args: ["--version"] },
    { command: "node", args: ["--help"] },
    { command: "npm", args: ["--version"] },
    { command: "npm", args: ["--help"] },
    { command: "npm", args: ["install"] },
    { command: "npm", args: ["ci"] },
    { command: "npm", args: ["init"] },
    { command: "npm", args: ["start"] },
    { command: "npm", args: ["test"] },
    { command: "npm", args: ["run", "dev"] },
    { command: "npm", args: ["run", "build"] },
    { command: "npm", args: ["run", "test"] },
    { command: "npm", args: ["run", "lint"] },
    { command: "npm", args: ["run", "typecheck"] },
    { command: "npm", args: ["list", "--depth=0"] },
    { command: "npx", args: ["tsc", "--noEmit"] },
    { command: "npx", args: ["tsx", "--version"] },
    { command: "npx", args: ["vite", "--version"] },
    { command: "tsc", args: ["--version"] },
    { command: "tsc", args: ["--noEmit"] },
    { command: "git", args: ["status"] },
    { command: "git", args: ["status", "--short"] },
    { command: "git", args: ["diff"] },
    { command: "git", args: ["diff", "--stat"] },
    { command: "git", args: ["init"] },
    { command: "python", args: ["--version"] },
    { command: "pip", args: ["--version"] },
    { command: "docker", args: ["--version"] },
];

const allowedCommands = new Set([
    "node",
    "npm",
    "npx",
    "tsc",
    "tsx",
    "vite",
    "vitest",
    "jest",
    "eslint",
    "prettier",
    "python",
    "pip",
    "git",
    "docker",
    "mongosh",
    "prisma",
    "code",
]);

function isSafeScriptPath(value: string): boolean {
    return (
        value.length > 0 &&
        !value.startsWith("-") &&
        !value.includes("..") &&
        !/[;&|`$<>!\r\n]/.test(value) &&
        /\.(?:js|mjs|cjs)$/i.test(value)
    );
}

function isAllowedDynamicCommand(
    command: string,
    args: string[],
): boolean {
    // Run a JavaScript file, e.g. node index.js
    if (command === "node") {
        return args.length === 1 && isSafeScriptPath(args[0]);
    }

    // Run an existing npm script, e.g. npm run start
    if (command === "npm") {
        if (
            args.length === 2 &&
            args[0] === "run" &&
            /^[a-zA-Z0-9:_-]+$/.test(args[1])
        ) {
            return true;
        }

        // Install named packages without shell operators or flags.
        if (
            args.length > 1 &&
            args[0] === "install" &&
            args.slice(1).every(
                (arg) =>
                    /^[a-zA-Z0-9@/._-]+$/.test(arg) &&
                    !arg.startsWith("-") &&
                    !arg.includes(".."),
            )
        ) {
            return true;
        }
    }

    // Permit a package runner to invoke a named tool.
    if (
        command === "npx" &&
        args.length >= 1 &&
        args.every((arg) => /^[a-zA-Z0-9@/._-]+$/.test(arg)) &&
        !args.some((arg) => arg.includes(".."))
    ) {
        return true;
    }

    return false;
}

export function isCommandAllowed(
    command: string,
    args: string[],
): boolean {
    // Reject paths and command-line operators in executable names.
    if (
        !allowedCommands.has(command) ||
        /[\\/;&|`$<>\r\n]/.test(command)
    ) {
        return false;
    }

    const exactMatch = exactRules.some(
        (rule) =>
            rule.command === command &&
            rule.args.length === args.length &&
            rule.args.every((arg, index) => arg === args[index]),
    );

    return exactMatch || isAllowedDynamicCommand(command, args);
}
