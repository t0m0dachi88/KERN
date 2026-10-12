import { readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { readFile } from "node:fs/promises";
import { resolveInsideWorkspace, WorkspaceBoundaryError } from "./pathBoundary.js";
import type { Tool } from "../types.js";

const IGNORED_DIRECTORIES = new Set([
    ".git",
    "node_modules",
]);

/**
 * Search for a text pattern inside files within a directory.
 *
 * The LLM sends a query (a word, phrase, or regex fragment) and an optional
 * search root. The tool walks the directory (skipping ignored folders) and
 * returns every file that contains the pattern, together with the matching
 * line(s).
 */
export const searchTool: Tool = {
    name: "search",
    description:
        "Search for a text pattern inside files. Returns file paths, line numbers, and the matching lines.",

    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The text pattern to search for.",
            },
            path: {
                type: "string",
                description:
                    "Directory to search in, relative to the current working directory. Use '.' for the project root.",
            },
        },
        required: ["query"],
    },

    // This is the function YOUR code runs when the LLM asks to use the tool
    async execute(args: Record<string, unknown>) {
        // --- argument validation ---
        let query: string;
        let path: string | undefined;

        try {
            const parsed = JSON.stringify(args);
            const obj = JSON.parse(parsed) as Record<string, unknown>;

            if (typeof obj.query !== "string" || obj.query.trim() === "") {
                return "Error: Invalid arguments. query must be a non-empty string.";
            }
            query = obj.query;

            if (obj.path !== undefined) {
                if (typeof obj.path !== "string" || obj.path.trim() === "") {
                    return "Error: Invalid arguments. path must be a non-empty string if provided.";
                }
                path = obj.path;
            }
        } catch {
            return "Error: Invalid arguments format.";
        }

        // --- resolve search root inside workspace ---
        const searchRoot = path
            ? await resolveInsideWorkspace(process.cwd(), path)
            : process.cwd();

        if (typeof searchRoot !== "string") {
            return "Error: Could not resolve search root.";
        }

        const queryLower = query.toLowerCase();
        const results: Array<{ file: string; line: number; match: string }> = [];

        async function walk(directory: string): Promise<void> {
            let entries: import("node:fs").Dirent[];
            try {
                entries = await readdir(directory, { withFileTypes: true });
            } catch {
                // Cannot read directory; skip.
                return;
            }

            for (const entry of entries) {
                // Skip ignored directories entirely.
                if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
                    continue;
                }

                const fullPath = join(directory, entry.name);

                // entry.isDirectory() and entry.isFile() are methods, not properties.
                if (entry.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }

                if (!entry.isFile()) {
                    continue;
                }

                // Only search common text file extensions to avoid binary noise.
                const nameLower = entry.name.toLowerCase();
                const allowedExts = [
                    ".ts",
                    ".tsx",
                    ".js",
                    ".jsx",
                    ".json",
                    ".mjs",
                    ".cjs",
                    ".py",
                    ".sh",
                    ".bash",
                    ".md",
                    ".txt",
                ];
                const hasAllowedExt = allowedExts.some((ext) => nameLower.endsWith(ext));
                if (!hasAllowedExt) {
                    continue;
                }

                try {
                    const content = await readFile(fullPath, "utf8");
                    const lines = content.split("\n");

                    for (let i = 0; i < lines.length; i++) {
                        const lineLower = lines[i].toLowerCase();
                        if (lineLower.includes(queryLower)) {
                            const relPath = relative(process.cwd(), fullPath);
                            results.push({
                                file: relPath,
                                line: i + 1,
                                match: lines[i].trim(),
                            });
                        }
                    }
                } catch {
                    // Unreadable or binary file; skip silently.
                }
            }
        }

        await walk(searchRoot);

        if (results.length === 0) {
            return `No matches found for "${query}".`;
        }

        // Format the top 20 matches to avoid flooding the context.
        const trimmed = results.slice(0, 20);
        return trimmed.map(
            (r) => `📄 ${r.file}:${r.line} — ${r.match}`
        ).join("\n");
    },
};