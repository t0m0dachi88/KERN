

Readme · MD
# Kern
 
A small coding agent and AI harness built from scratch to understand how modern AI coding agents work internally.
 
Kern is an educational AI coding-agent project built with TypeScript and Node.js. Instead of treating an AI coding agent as a black box, Kern rebuilds its fundamental components step by step.
 
The goal is not simply to create another chatbot. The goal is to understand how an LLM becomes an agent by giving it the ability to interact with external tools, receive the results of those tools, and continue working based on that information.
 
---
 
## Table of Contents
 
1. [Project Overview](#1-project-overview)
2. [What Is Kern?](#2-what-is-kern)
3. [Core Learning Objectives](#3-core-learning-objectives)
4. [Current Technology Stack](#4-current-technology-stack)
5. [Current Architecture](#5-current-architecture)
6. [The Current Tool System](#6-the-current-tool-system)
7. [The Agent Loop](#7-the-agent-loop)
8. [Example: Reading a Codebase](#8-example-reading-a-codebase)
9. [Why Tool Calling Matters](#9-why-tool-calling-matters)
10. [LLM vs Agent](#10-llm-vs-agent)
11. [Tool Registry](#11-tool-registry)
12. [Context Management](#12-context-management)
13. [Error Handling](#13-error-handling)
14. [Long-Term Architecture](#14-long-term-architecture)
15. [Planned Tools](#15-planned-tools)
16. [From File Reader to Coding Agent](#16-from-file-reader-to-coding-agent)
17. [Safety and Tool Boundaries](#17-safety-and-tool-boundaries)
18. [Core Design Philosophy](#18-core-design-philosophy)
19. [Example End-to-End Workflow](#19-example-end-to-end-workflow)
20. [What Makes Kern Different From a Chatbot?](#20-what-makes-kern-different-from-a-chatbot)
21. [Final Goal](#21-final-goal)
22. [The Central Idea](#22-the-central-idea)
---
 
## 1. Project Overview
 
A normal LLM interaction looks approximately like this:
 
```
User
  ↓
LLM
  ↓
Response
```
 
The model receives a prompt and generates an answer.
 
A coding agent requires an additional layer of interaction. The model needs to be able to perform actions outside the model itself.
 
Kern implements this fundamental agent loop:
 
```
User
  ↓
LLM
  ↓
Tool Call
  ↓
Tool Execution
  ↓
Tool Result
  ↓
LLM
  ↓
Tool Call / Final Response
```
 
The important idea is that **the LLM does not directly execute tools**. Instead:
 
1. The LLM decides that a tool is necessary.
2. The LLM produces a structured tool call.
3. Kern receives that tool call.
4. Kern executes the corresponding tool.
5. Kern sends the result back to the LLM.
6. The LLM analyzes the result.
7. The LLM can either call another tool or produce a final response.
This loop is the foundation of modern AI agents.
 
---
 
## 2. What Is Kern?
 
Kern is a lightweight AI agent harness. An agent harness is the infrastructure surrounding an LLM that allows the model to interact with the outside world.
 
**The LLM is responsible primarily for:**
 
- Understanding the user's request
- Reasoning about what needs to be done
- Deciding whether a tool is required
- Selecting an appropriate tool
- Generating tool arguments
- Interpreting tool results
- Deciding what to do next
- Producing the final response
**Kern is responsible for:**
 
- Managing the conversation
- Sending requests to the LLM
- Receiving model responses
- Detecting tool calls
- Executing tools
- Returning tool results to the LLM
- Maintaining the agent loop
- Managing application-level state
This separation is important. The LLM provides the intelligence, while Kern provides the execution environment.
 
---
 
## 3. Core Learning Objectives
 
Kern is being developed incrementally to understand the major components behind modern coding agents.
 
### LLM API Integration
 
Understanding how an application communicates with a large language model through an API. Topics include:
 
- API authentication
- Request construction
- Model selection
- Messages
- Responses
- Errors
- Streaming
### Streaming Responses
 
Instead of waiting for the entire model response, Kern can progressively receive generated output.
 
```
LLM
 ↓
"Let's"
 ↓
"inspect"
 ↓
"the"
 ↓
"file..."
```
 
Streaming is important for interactive AI applications because users can see progress before the complete response has been generated.
 
### Message History
 
The LLM does not automatically remember everything that happened in an application, so Kern maintains conversation state. For example:
 
```
User:
Read package.json
 
Assistant:
I need to inspect package.json.
 
Tool Call:
read("package.json")
 
Tool:
{ package.json contents }
 
Assistant:
The project uses TypeScript...
```
 
Each step becomes part of the message history sent to the model.
 
### Tool Calling
 
Tool calling allows the LLM to request an external operation.
 
```json
{
  "name": "read",
  "arguments": {
    "path": "package.json"
  }
}
```
 
The model is not actually reading the file. It is asking Kern to execute the read operation.
 
### Tool Execution
 
Kern receives the requested operation and maps it to an actual function.
 
```
LLM
 ↓
read("package.json")
 ↓
Kern
 ↓
Filesystem
 ↓
package.json
```
 
Kern then converts the result into a message that can be sent back to the model.
 
### Agent Loops
 
A coding agent rarely finishes a task in one model call. A typical task may require:
 
```
Understand request
      ↓
Inspect files
      ↓
Analyze code
      ↓
Inspect another file
      ↓
Modify code
      ↓
Run command
      ↓
Inspect result
      ↓
Fix issue
      ↓
Return final response
```
 
Kern is designed to gradually support this iterative process.
 
### Context and State
 
As the agent performs more actions, Kern needs to keep track of:
 
- User messages
- Assistant responses
- Tool calls
- Tool results
- Execution state
- Relevant project information
This introduces one of the most important problems in AI agents:
 
> How do we maintain useful context while the agent performs multiple operations?
 
### Filesystem Interaction
 
A coding agent needs access to the project it is working on. Kern therefore gradually introduces filesystem tools such as `read`, `write`, `list`, and `search`. These tools allow the model to interact with a real codebase.
 
---
 
## 4. Current Technology Stack
 
| Technology | Purpose |
| --- | --- |
| TypeScript | Main programming language |
| Node.js | Runtime environment |
| Groq API | LLM API provider |
| OpenAI-compatible API | Communication interface |
| GPT-OSS 20B | Current language model |
| tsx | TypeScript execution during development |
| dotenv | Environment variable management |
 
The use of an OpenAI-compatible API also makes the architecture easier to adapt to different compatible model providers in the future.
 
---
 
## 5. Current Architecture
 
The current project is intentionally small.
 
```
src/
├── main.ts
├── types.ts
└── tools/
    └── readTool.ts
```
 
Each file has a specific responsibility.
 
### `src/main.ts`
 
`main.ts` is the main entry point of Kern and coordinates the agent.
 
```
User Input
    ↓
main.ts
    ↓
LLM Request
    ↓
LLM Response
    ↓
Tool Call?
   /    \
 No      Yes
 |        |
 ↓        ↓
Final   Execute Tool
Response    ↓
          Result
            ↓
           LLM
```
 
As Kern evolves, this file will contain the core agent loop.
 
### `src/types.ts`
 
`types.ts` contains shared TypeScript definitions. For example, Kern may define concepts such as:
 
```ts
type Message = {
  role: "user" | "assistant" | "tool";
  content: string;
};
```
 
And tool definitions such as:
 
```ts
interface ToolSpec {
  name: string;
  description: string;
  parameters: object;
}
```
 
These types provide a consistent structure for communication between different parts of the system.
 
### `src/tools/readTool.ts`
 
This module contains the implementation of the current read tool. Its purpose is simple: read the contents of a file and return those contents to Kern.
 
```
LLM requests:
read("package.json")
        ↓
readTool.ts
        ↓
Filesystem
        ↓
package.json contents
        ↓
Kern
        ↓
LLM
```
 
This may look simple, but it represents a fundamental transition: **the LLM can now interact with the environment.**
 
---
 
## 6. The Current Tool System
 
Kern currently has one basic tool: `read`.
 
The read tool allows the model to inspect a file. Example request:
 
```
read("src/main.ts")
```
 
The tool executes the filesystem operation and returns the contents.
 
```ts
async function readTool(path: string): Promise<string> {
  // Read file
  // Return contents
}
```
 
The important architectural principle is that the tool itself should not need to understand the user's overall task. Its responsibility is only:
 
```
Input → Execute Operation → Return Result
```
 
The LLM handles the reasoning.
 
---
 
## 7. The Agent Loop
 
The most important part of Kern is the agent loop. A simplified version looks like this:
 
```
┌──────────────────┐
│      User        │
└────────┬─────────┘
         ↓
┌──────────────────┐
│       LLM        │
└────────┬─────────┘
         ↓
   Tool requested?
      /       \
    No         Yes
    ↓           ↓
 Final      Tool Call
 Response       ↓
            Tool Executor
                 ↓
            Tool Result
                 ↓
                LLM
                 │
                 └───────→ Continue
```
 
The important part is the loop:
 
```
LLM → Tool → Result → LLM → Tool → Result → LLM
```
 
The process continues until the model determines that it has enough information to provide a final response.
 
---
 
## 8. Example: Reading a Codebase
 
Suppose the user asks: *What framework is this project using?*
 
**Step 1 — User Request**
 
```
User:
What framework is this project using?
```
 
**Step 2 — LLM Decision**
 
The model decides: *I need to inspect `package.json`.*
 
**Step 3 — Tool Call**
 
```
read("package.json")
```
 
**Step 4 — Kern Executes the Tool**
 
```
readTool
   ↓
filesystem
   ↓
package.json
```
 
**Step 5 — Tool Result**
 
Kern sends the file contents back to the model.
 
```
Tool Result:
{
  "dependencies": {
    "express": "...",
    ...
  }
}
```
 
**Step 6 — LLM Interprets the Result**
 
The model now knows that the project uses Express.
 
**Step 7 — Final Response**
 
```
The project uses Express as its backend framework.
```
 
This simple example demonstrates the complete agent cycle.
 
---
 
## 9. Why Tool Calling Matters
 
Without tools, an LLM can only reason over the information provided in its context. For a coding agent, that is insufficient. A coding agent needs to interact with an environment.
 
**LLM alone:**
 
> "Here is some code. Tell me what it does."
 
**Coding agent:**
 
> "Inspect the project. Find the relevant files. Understand the implementation. Modify the code. Run tests. Fix errors."
 
The second workflow requires tools. Tools effectively provide the model with capabilities:
 
```
read     → inspect information
write    → modify information
search   → find information
shell    → execute commands
```
 
The LLM decides what should happen. The harness determines how it actually happens.
 
---
 
## 10. LLM vs Agent
 
One of the main concepts Kern is designed to demonstrate is the difference between an LLM and an agent.
 
**LLM**
 
```
Input
 ↓
Reasoning / Generation
 ↓
Output
```
 
**Agent**
 
```
Input
 ↓
Reason
 ↓
Action
 ↓
Observe
 ↓
Reason
 ↓
Action
 ↓
Observe
 ↓
...
 ↓
Final Answer
```
 
Therefore:
 
> An agent is not necessarily a different kind of model. It is an LLM operating inside a system that gives it tools, state, and an execution loop.
 
This distinction is one of the central ideas behind Kern.
 
---
 
## 11. Tool Registry
 
As the number of tools grows, Kern should avoid hard-coding every tool directly into `main.ts`. A future architecture can introduce a tool registry:
 
```
Tool Registry
├── read
├── write
├── list
├── search
└── shell
```
 
The LLM receives the available tool specifications. For example:
 
```ts
interface Tool {
  name: string;
  description: string;
  parameters: object;
  execute(args: Record<string, unknown>): Promise<string>;
}
```
 
Kern can then dynamically find the requested tool:
 
```
LLM
 ↓
tool name: "read"
 ↓
Tool Registry
 ↓
read.execute(...)
```
 
This makes the architecture easier to extend.
 
---
 
## 12. Context Management
 
As the agent performs more operations, the conversation can become very large.
 
```
User request
 ↓
File A
 ↓
File B
 ↓
File C
 ↓
Search results
 ↓
Command output
 ↓
Another file
 ↓
Error
 ↓
Correction
```
 
Sending everything to the model forever is inefficient. Therefore, a future version of Kern can explore:
 
- Context limits
- Message pruning
- Summarization
- Relevant-context retrieval
- Tool-result compression
- Working memory
- Long-term project context
This introduces an important challenge:
 
> How can an agent remember what matters without carrying the entire history forever?
 
---
 
## 13. Error Handling
 
Real tools can fail. For example, `read("missing.ts")` may produce:
 
```
Error: File not found
```
 
The agent should not necessarily crash. Instead, the error can become another observation:
 
```
LLM
 ↓
read("missing.ts")
 ↓
Tool
 ↓
Error: File not found
 ↓
LLM
```
 
The model can then decide what to do next: *the requested file does not exist, so I'll inspect the directory first.*
 
```
list(".")
```
 
This is an important characteristic of agentic systems: **failures can become information that influences the next action.**
 
---
 
## 14. Long-Term Architecture
 
Kern is intended to evolve gradually. A possible future architecture is:
 
```
                        ┌───────────────┐
                        │     User      │
                        └───────┬───────┘
                                ↓
                        ┌───────────────┐
                        │ Agent Runtime │
                        └───────┬───────┘
                                ↓
                        ┌───────────────┐
                        │      LLM      │
                        └───────┬───────┘
                                ↓
                         Tool Decision
                                ↓
                       ┌────────────────┐
                       │  Tool Registry │
                       └───────┬────────┘
                               ↓
        ┌──────────────┬───────┴────────┬──────────────┐
        ↓              ↓                ↓              ↓
      Read           Write            Search         Shell
        │              │                │              │
        └──────────────┴───────┬────────┴──────────────┘
                               ↓
                         Tool Results
                               ↓
                              LLM
                               ↓
                       Continue / Finish
```
 
This architecture can eventually support real coding-agent workflows.
 
---
 
## 15. Planned Tools
 
The toolset can gradually expand.
 
| Tool | Purpose | Signature |
| --- | --- | --- |
| `read` | Read a file | `read(path)` |
| `write` | Create or overwrite a file | `write(path, content)` |
| `list` | List files and directories | `list(path)` |
| `search` | Search the codebase for a string, symbol, or pattern | `search(query)` |
| `shell` | Execute a controlled terminal command | `shell(command)` |
 
These tools together provide a basic coding environment.
 
---
 
## 16. From File Reader to Coding Agent
 
The project can evolve through several stages.
 
### Phase 1 — LLM Communication
 
Build the basic communication layer: `User → LLM → Response`.
 
Learn: API requests, environment variables, message formats, model responses.
 
### Phase 2 — Streaming
 
Add streamed model output.
 
```
LLM → Chunk → Chunk → Chunk → Complete Response
```
 
Learn: async iteration, streams, incremental output, response handling.
 
### Phase 3 — Tool Calling
 
Introduce structured tools: `LLM → Tool Call → Tool Executor`. Start with `read`.
 
### Phase 4 — Agent Loop
 
Allow the model to continue after tool execution.
 
```
LLM → Tool → Result → LLM → Tool → Result → Final Response
```
 
This is where Kern becomes an actual agent rather than simply an LLM wrapper.
 
### Phase 5 — Filesystem Agent
 
Introduce additional filesystem capabilities: `read`, `write`, `list`, `search`. Kern can now inspect and modify a project.
 
### Phase 6 — Shell Execution
 
Introduce controlled command execution, for example:
 
```
npm test
npm run build
git status
```
 
The agent can then observe command output and react to failures.
 
### Phase 7 — Coding Workflows
 
Kern can begin performing multi-step coding tasks. Example:
 
```
User:
Add input validation to the login endpoint.
```
 
Kern could:
 
1. Inspect project structure
2. Find login endpoint
3. Read relevant files
4. Understand existing validation
5. Modify the implementation
6. Run tests
7. Inspect failures
8. Fix problems
9. Run tests again
10. Explain the changes
At this point, Kern starts behaving like a small coding agent.
 
---
 
## 17. Safety and Tool Boundaries
 
Giving an LLM tools also introduces risks. A tool such as `shell(command)` can potentially perform destructive operations, for example `rm -rf ...`.
 
A real coding-agent harness therefore needs boundaries around tool execution. Future versions of Kern can explore:
 
- Allowed commands
- Working-directory restrictions
- Path validation
- Permission checks
- Confirmation before destructive actions
- Tool timeouts
- Output limits
- Error handling
- Sandboxing
A capable agent is not only about giving the model more tools. It is also about controlling what those tools are allowed to do.
 
---
 
## 18. Core Design Philosophy
 
Kern follows several principles.
 
### 1. Understand Before Abstracting
 
The project intentionally starts with simple implementations. Rather than immediately using a large agent framework, Kern builds the underlying mechanisms directly.
 
### 2. Small Components
 
Each component should have a clear responsibility.
 
```
LLM communication
        ↓
Agent loop
        ↓
Tool registry
        ↓
Individual tools
```
 
### 3. Incremental Development
 
The project grows one capability at a time, instead of immediately attempting to build a complete coding agent.
 
```
LLM → Streaming → Tool calling → Agent loop → Filesystem → Shell → Coding workflows
```
 
Each stage provides a concrete learning milestone.
 
### 4. Architecture Over Copying
 
The objective is not to reproduce an existing coding agent line by line. The objective is to understand the architectural ideas behind these systems. Kern therefore prioritizes:
 
- Understanding
- Experimentation
- Simplicity
- Observability
- Incremental complexity
---
 
## 19. Example End-to-End Workflow
 
Eventually, a Kern session could look like this:
 
```
User:
Find why the tests are failing and fix the issue.
```
 
**Agent loop**
 
```
User Request
     ↓
LLM analyzes request
     ↓
list(".")
     ↓
Tool Result
     ↓
LLM identifies test directory
     ↓
search("...")
     ↓
Tool Result
     ↓
read("src/...")
     ↓
Tool Result
     ↓
LLM identifies possible bug
     ↓
read("test/...")
     ↓
Tool Result
     ↓
LLM determines fix
     ↓
write("src/...")
     ↓
Tool Result
     ↓
shell("npm test")
     ↓
Test Output
     ↓
LLM analyzes failure
     ↓
write(...)
     ↓
shell("npm test")
     ↓
Tests Pass
     ↓
Final Response
```
 
This illustrates the fundamental power of an agent: the model does not need to know everything beforehand. It can gather information, act, observe the result, and adapt.
 
---
 
## 20. What Makes Kern Different From a Chatbot?
 
A chatbot primarily responds to information supplied by the user. Kern is designed to interact with an environment.
 
**Chatbot**
 
```
User
 ↓
LLM
 ↓
Answer
```
 
**Kern**
 
```
User
 ↓
LLM
 ↓
Action
 ↓
Environment
 ↓
Observation
 ↓
LLM
 ↓
Action
 ↓
...
 ↓
Answer
```
 
The environment becomes part of the reasoning process. For a coding agent, that environment is the user's codebase.
 
---
 
## 21. Final Goal
 
The long-term goal of Kern is to build a lightweight coding agent capable of working with a real project. Kern should eventually be able to:
 
1. Understand a user's request.
2. Inspect the project.
3. Determine which information it needs.
4. Select appropriate tools.
5. Execute those tools.
6. Interpret their results.
7. Maintain useful context.
8. Modify files when necessary.
9. Execute tests or development commands.
10. Analyze failures.
11. Iterate on its work.
12. Produce a final explanation.
The complete system can be summarized as:
 
```
                    ┌──────────────┐
                    │     User     │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │     Kern     │
                    │ Agent Runtime│
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │      LLM     │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Tool Decision│
                    └──────┬───────┘
                           ↓
                 ┌─────────────────────┐
                 │    Tool Execution   │
                 └──────────┬──────────┘
                            ↓
                       Environment
                            │
                 ┌──────────┴──────────┐
                 ↓                     ↓
             Filesystem             Shell
                 │                     │
                 └──────────┬──────────┘
                            ↓
                       Tool Result
                            ↓
                           LLM
                            │
                    ┌───────┴────────┐
                    ↓                ↓
               More Actions      Final Answer
```
 
---
 
## 22. The Central Idea
 
The most important concept behind Kern can be expressed in one sentence:
 
> Kern explores how an LLM can be transformed from a text generator into an agent capable of interacting with and operating on a real software environment.
 
The project starts with something extremely small:
 
```
LLM + read(file)
```
 
and gradually builds toward:
 
```
LLM
 +
Tools
 +
Execution
 +
Context
 +
Agent Loop
 +
Filesystem
 +
Shell
 +
Iteration
 =
Coding Agent
```
 
That progression is the real purpose of Kern.
 
It is not just about building a coding assistant. It is about understanding what actually happens underneath a modern AI coding agent.
 
Claude finished the response
