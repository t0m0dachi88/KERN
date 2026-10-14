
type CommandRule = {
    command: string;
    args: string[];
};

export const commandAllowList: CommandRule[] = [
    // Node.js
    { command: "node", args: ["--version"] },
    { command: "node", args: ["--help"] },
    { command: "node", args: ["--check"] },

    // npm
    { command: "npm", args: ["--version"] },
    { command: "npm", args: ["--help"] },
    { command: "npm", args: ["init"] },
    { command: "npm", args: ["install"] },
    { command: "npm", args: ["ci"] },
    { command: "npm", args: ["list", "--depth=0"] },
    { command: "npm", args: ["outdated"] },
    { command: "npm", args: ["audit"] },
    { command: "npm", args: ["run", "dev"] },
    { command: "npm", args: ["run", "build"] },
    { command: "npm", args: ["run", "test"] },
    { command: "npm", args: ["run", "lint"] },
    { command: "npm", args: ["run", "typecheck"] },

    // npx
    { command: "npx", args: ["tsc", "--noEmit"] },
    { command: "npx", args: ["tsx", "--version"] },
    { command: "npx", args: ["vite", "--version"] },
    { command: "npx", args: ["eslint", "--version"] },
    { command: "npx", args: ["prettier", "--version"] },
    { command: "npx", args: ["create-vite"] },
    { command: "npx", args: ["create-next-app"] },
    {
    command: "node",
    args: ["node_modules/typescript/bin/tsc", "--noEmit"],
},
    {
    command: "node",
    args: ["node_modules/typescript/bin/tsc", "--noEmit"],
},

    // TypeScript and development tools
    { command: "tsc", args: ["--version"] },
    { command: "tsc", args: ["--noEmit"] },
    { command: "tsc", args: ["--init"] },
    { command: "tsx", args: ["--version"] },
    { command: "vitest", args: ["run"] },
    { command: "jest", args: ["--runInBand"] },
    { command: "eslint", args: ["--version"] },
    { command: "prettier", args: ["--check"] },
    { command: "vite", args: ["--version"] },

    // Git: inspection
    { command: "git", args: ["status"] },
    { command: "git", args: ["status", "--short"] },
    { command: "git", args: ["diff"] },
    { command: "git", args: ["diff", "--stat"] },
    { command: "git", args: ["log", "-5", "--oneline"] },
    { command: "git", args: ["branch", "--show-current"] },
    { command: "git", args: ["show"] },

    // Git: changes
    { command: "git", args: ["init"] },
    { command: "git", args: ["add", "."] },
    { command: "git", args: ["commit"] },
    { command: "git", args: ["fetch"] },
    { command: "git", args: ["pull"] },
    { command: "git", args: ["push"] },
    { command: "git", args: ["stash"] },

    // Windows file and directory utilities
    { command: "dir", args: [] },
    { command: "tree", args: [] },
    { command: "where", args: [] },
    { command: "whoami", args: [] },
    { command: "mkdir", args: [] },
    { command: "copy", args: [] },
    { command: "move", args: [] },
    { command: "type", args: [] },
    { command: "findstr", args: [] },

    // Python development
    { command: "python", args: ["--version"] },
    { command: "pip", args: ["--version"] },

    // Docker
    { command: "docker", args: ["--version"] },
    { command: "docker", args: ["ps"] },
    { command: "docker", args: ["images"] },

    // MongoDB
    { command: "mongosh", args: ["--version"] },

    // Prisma
    { command: "prisma", args: ["--version"] },

    // VS Code
    { command: "code", args: ["--version"] },
];




export function isCommandAllowed(
    command: string,
    args: string[]
): boolean {
    return commandAllowList.some((rule) => {
        if (rule.command !== command) {
            return false;
        }

        // Exact match for rules with predefined arguments.
        if (rule.args.length > 0) {
            return (
                rule.args.length === args.length &&
                rule.args.every(
                    (allowedArg, index) => allowedArg === args[index]
                )
            );
        }

        // Empty argument lists allow the command with any arguments.
        return true;
    });
}
