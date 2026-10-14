import { readFile,writeFile } from "node:fs/promises";
import { Tool } from "../types.js";
import { resolveInsideWorkspace, WorkspaceBoundaryError } from "./pathBoundary.js";

// Workspace root: the directory Kern was launched from, captured once at startup.
const WORKSPACE_ROOT = process.cwd();


export const editTool: Tool = {
    name: "edit",
    description: "Replace an exact, unique piece of text in a file.",

    // This is JSON Schema. It tells the LLM exactly what arguments to provide.
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Path to the file, relative to the current folder",
            },
            oldText:{
                type:"string",
                description:"Exact text to find"
            },
            newText:{ 
                type:"string",
                description:"replacement of text"

            }
        },
        required: ["path","oldText","newText"],
    },

    // This is the function YOUR code runs when the LLM asks to use the tool
    async execute(args) {
        if (
            typeof args.path !== "string" ||
            typeof args.oldText !== "string" ||
            typeof args.newText !== "string" ||
            args.oldText.length === 0
        ) {
            return "Error: Invalid arguments. path, oldText and newText must be strings, and oldText must not be empty.";
        }

        const path = args.path;
        const oldText = args.oldText;
        const newText = args.newText;
   
if (oldText === newText) {
    return `No changes needed: oldText and newText are identical in ${path}.`;
}

        try {
            const targetPath = await resolveInsideWorkspace(WORKSPACE_ROOT, path);
            const content = await readFile(targetPath, "utf8");
            const firstIndex = content.indexOf(oldText);

            if (firstIndex === -1) {
                return `Error: The text to replace was not found in ${path}. No changes made.`;
            }

            if (firstIndex !== content.lastIndexOf(oldText)) {
                return `Error: The text appears more than once in ${path}. No changes made.`;
            }

            const updatedContent =
                content.slice(0, firstIndex) +
                newText +
                content.slice(firstIndex + oldText.length);
            await writeFile(targetPath, updatedContent, "utf-8");
            return `Successfully edited ${path}`;
        } catch (error) {
            if (error instanceof WorkspaceBoundaryError) {
                return `Error: ${error.message}`;
            }
            const reason = error instanceof Error ? error.message : String(error);
            return `Error editing ${path}: ${reason}`;
        }
    },
};



/*
Boundary check: edit calls resolveInsideWorkspace before reading or writing, instead of the unchecked resolve(process.cwd(), path).
Workspace root: process.cwd() captured once when the module loads, as I proposed.
Boundary errors: returned as a clear string error, and nothing is read or written.
Cleanup: the now-unused resolve import goes away.

read, ls and shell stay untouched.
*/