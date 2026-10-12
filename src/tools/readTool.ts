import { readFile } from "node:fs/promises";
import { resolveInsideWorkspace, WorkspaceBoundaryError } from "./pathBoundary.js";
import { Tool } from "../types.js";

const WORKSPACE_ROOT = process.cwd();

export const readTool: Tool = {
    name: "read",
    description: "Read a text file and returns its contents",

    // This is JSON Schema. It tells the LLM exactly what arguments to provide.
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Path to the file, relative to the current folder",
            },
        },
        required: ["path"],
    },

    // This is the function YOUR code runs when the LLM asks to use the tool
    async execute(args) {
        if (
            typeof args.path !== "string" ||
            args.path.trim() === ""
        ) {
            return "Error: Invalid arguments. path must be a non-empty string.";
        }

        try {
            const targetPath = await resolveInsideWorkspace(
                WORKSPACE_ROOT,
                args.path
            );

            return await readFile(targetPath, "utf8");
        } catch (error) {
            if (error instanceof WorkspaceBoundaryError) {
                return `Error: ${error.message}`;
            }
            const reason = error instanceof Error ? error.message : String(error);
            return `Error reading ${args.path}: ${reason}`;
        }
    },
};


