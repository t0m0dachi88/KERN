import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Tool } from "../types.js";



export const lsTool: Tool = {
    name: "ls",
    description: "Read a folder and returns its contents",

    // This is JSON Schema. It tells the LLM exactly what arguments to provide.
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Path to the folder, relative to the current folder",
            },
        },
        required: ["path"],
    },

    // This is the function YOUR code runs when the LLM asks to use the tool
    async execute(args) {
        // Resolve the path relative to where you ran the `npx tsx` command
        const targetPath = resolve(process.cwd(), String(args.path));

        // Read the folder and return its content as a string
        const entries=await  readdir(targetPath, "utf8");
        return entries.join("\n")
    },
};
