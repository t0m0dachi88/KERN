
type CommandRule = {
    command: string;
    args: string[];
};

export const commandAllowList: CommandRule[] = [
    {
        command: "node",
        args: ["--version"],
    },
    {
        command: "npm",
        args: ["--version"],
    },
    {
        command: "git",
        args: ["status"],
    },
    {
        command: "git",
        args: ["diff", "--stat"],
    },
];




export function isCommandAllowed(
    command: string,
    args: string[]
): boolean {
    for (let i = 0; i < commandAllowList.length; i++) {
        const rule = commandAllowList[i];

        if (rule.command === command) {
            if (rule.args.length !== args.length) {
                continue;
            }

            const argsMatch = rule.args.every(
                (allowedArg, index) => allowedArg === args[index]
            );

            if (argsMatch) {
                return true;
            }
        }
    }

    return false;
}