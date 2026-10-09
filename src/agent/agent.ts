import Groq from "groq-sdk";
import { Message, Tool,AgentEvent,EventHandler } from "../types.js";

const MAX_TURNS = 10;

export async function runAgent(
    groq: Groq,
    messages: Message[],
    tools: Tool[],
    onEvent:EventHandler
): Promise<void> {

    for (let turn = 0; turn < MAX_TURNS; turn++) {
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
        onEvent({
            type:"error",
            message:`llem error : ${err}`
        })
 
    };
    
        let toolCallName :string = "";
        let toolCallArgs:string = "";
        let toolCallId :string = "";

        for await (const chunk of stream) {

            const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
           fullResponse += delta.content;

        onEvent({
        type: "text",
        content: delta.content
    });
}

            if (delta?.tool_calls) {

                const tc = delta.tool_calls[0];

                if (tc?.id) {
                    toolCallId = tc.id;
                }

                if (tc?.function?.name) {
                    toolCallName = tc.function.name;
                }

                if (tc?.function?.arguments) {
                    toolCallArgs += tc.function.arguments;
                }
            }
        }
    
    
         let errorMessage:string="";
        // No tool requested → final response
        if (!toolCallName) {

            messages.push({
                role: "assistant",
                content: fullResponse,
            });

            return;
        }

        // Model requested a tool
        messages.push({
            role: "assistant",
            content: null,
            tool_calls: [
                {
                    id: toolCallId,
                    type: "function",
                    function: {
                        name: toolCallName,
                        arguments: toolCallArgs,
                    },
                },
            ],
        } as any);

        // Find the requested tool
        const tool = tools.find(
            (tool) => tool.name === toolCallName
        );
       
        if (!tool) {
       errorMessage = `Unknown tool: ${toolCallName}`;
            messages.push({
                role: "tool",
                tool_call_id: toolCallId,
                content: `Unknown tool: ${toolCallName}`,
            } as any);

            continue;
        }
        onEvent({
        type: "tool_result",
        name: toolCallName,
        result: errorMessage,
    });

        
     let toolResult: string;

      try {
         const parsedArgs = JSON.parse(toolCallArgs);

      try {
        toolResult = await tool.execute(parsedArgs);
    } catch (error) {
        toolResult = `Tool execution error: ${error}`;
    }

} catch (error) {
    toolResult = `Invalid tool arguments: ${error}`;
}
        
       onEvent({
       type: "tool_result",
       name: toolCallName,
       result: toolResult,
      });
       

        // Give result back to model
        messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: toolResult,
        } as any);

        
    }

    
}