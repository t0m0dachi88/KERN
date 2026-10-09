
import { readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import type { Tool } from "../types.js";

const IGNORED_DIRECTORIES = new Set([
    ".git",
    "node_modules",
]);

export const lsTool: Tool = {
    name: "ls",
    description:
        "Recursively list files and directories. Excludes .git and node_modules by default.",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description:
                    "Directory to list, relative to the current working directory. Use '.' for the project root.",
            },
        },
        required: ["path"],
    },

    async execute(args) {
        const targetPath = resolve(
            process.cwd(),
            String(args.path ?? ".")
        );

        const results: string[] = [];

        async function walk(directory: string): Promise<void> {
            const entries = await readdir(directory, {
                withFileTypes: true,
            });

            for (const entry of entries) {
                const fullPath = join(directory, entry.name);
                const relativePath = relative(targetPath, fullPath);

                if (
                    entry.isDirectory() &&
                    IGNORED_DIRECTORIES.has(entry.name)
                ) {
                    continue;
                }

                results.push(relativePath);

                if (entry.isDirectory()) {
                    await walk(fullPath);
                }
            }
        }

        await walk(targetPath);

        return results.length > 0
            ? results.join("\n")
            : "Directory is empty.";
    },
};