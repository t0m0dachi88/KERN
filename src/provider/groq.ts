import Groq from "groq-sdk";
import dotenv from "dotenv";
import { } from "groq-sdk";
import { Message, Tool,AgentEvent,EventHandler } from "../types.js";
dotenv.config();

 export  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, // reads from .env
});

export async function groqResponse( messages: Message[],
    tools: Tool[]){
  

let stream;
        let fullResponse = "";
        try{
         stream = await groq.chat.completions.create({
            messages: messages as any,
            tools: tools.map((tool) => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            })),
            model: "openai/gpt-oss-20b",
            stream: true,
        });
    } catch(err){ 
        throw err
 
    };
  
 return stream
}




