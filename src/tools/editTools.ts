import { readFile,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Tool } from "../types.js";


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
  typeof args.oldText!== "string" ||
  typeof args.newText!== "string"||
  args.oldText.length === 0
) {
  return { content: "Error: Invalid arguments." };
}
const targetPath = resolve(process.cwd(), args.path);
        const oldText=args.oldText
        const newText=args.newText
  try{
    const content=await readFile(targetPath, "utf8");
     if (!content.includes(oldText)) {
  return   "Error: The text to replace was not found." 
}
const firstIndex = content.indexOf(oldText);
const lastIndex = content.lastIndexOf(oldText);

if (firstIndex !== lastIndex) {
  return  "Error: The text appears more than once. No changes made."
  
}
const updatedContent = content.replace(oldText, newText);
await writeFile(targetPath, updatedContent, "utf-8");
return  `Successfully edited ` 
  }catch(error){
     return 
         `Error editing file`
  }
     
    },
};


