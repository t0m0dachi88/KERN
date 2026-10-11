
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";

import type { Message } from "./types.js";
import { tools } from "./tools/index.js";
import { groqProvider } from "./provider/groq.js";
import { runAgent } from "./agent/agent.js";

const messages: Message[] = [];

const color = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    purple: "\x1b[35m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
    white: "\x1b[97m",
};

function paint(text: string, shade: string): string {
    return `${shade}${text}${color.reset}`;
}

function printBanner(): void {
    console.log();
    console.log(paint("  ⚡ K E R N", `${color.bold}${color.cyan}`));
    console.log(paint("  AI CODING AGENT", color.purple));
    console.log(
        paint("  Your terminal. Your code. Your agent.", color.gray)
    );
    console.log();
    console.log(
        paint("  Workspace: ", color.gray) +
        paint(resolve(process.cwd()), color.yellow)
    );
    console.log(
        paint("  Type /help for commands, or /exit to quit.", color.gray)
    );
    console.log();
}

function printHelp(): void {
    console.log();
    console.log(paint("  KERN COMMANDS", `${color.bold}${color.cyan}`));
    console.log(`  ${paint("/help", color.green)}    Show this help message`);
    console.log(`  ${paint("/clear", color.green)}   Clear conversation history`);
    console.log(`  ${paint("/status", color.green)}  Show workspace and status`);
    console.log(`  ${paint("/exit", color.green)}    Exit Kern`);
    console.log(`  ${paint("/quit", color.green)}    Exit Kern`);
    console.log();
}

async function readUserInput(): Promise<string | null> {
    const readline = createInterface({
        input: stdin,
        output: stdout,
    });

    try {
        return await readline.question(
            `${paint("❯ kern", `${color.bold}${color.cyan}`)} `
        );
    } catch {
        return null;
    } finally {
        readline.close();
    }
}

async function runPrompt(prompt: string): Promise<void> {
    messages.push({
        role: "user",
        content: prompt,
    });

    await runAgent(groqProvider, messages, tools, (event) => {
        switch (event.type) {
            case "text":
                process.stdout.write(paint(event.content, color.white));
                break;

            case "tool_call":
                console.log(
                    `\n\n${paint("◆ TOOL", color.purple)} ${paint(event.name, color.yellow)}`
                );
                break;

            case "tool_result":
                console.log(paint("  └─ RESULT", color.gray));
                console.log(paint(event.result, color.gray));
                break;

            case "error":
                console.error(
                    `\n${paint("✖ ERROR", color.red)} ${event.message}`
                );
                break;

            case "done":
                console.log();
                console.log(paint("✓ Done", color.green));
                break;
        }
    });
}

async function main(): Promise<void> {
    printBanner();

    while (true) {
        const input = await readUserInput();

        if (input === null) {
            console.log(`\n${paint("Goodbye!", color.cyan)}`);
            return;
        }

        const prompt = input.trim();

        if (prompt.length === 0) {
            continue;
        }

        if (prompt === "/exit" || prompt === "/quit") {
            console.log(`\n${paint("Goodbye!", color.cyan)}`);
            return;
        }

        if (prompt === "/help") {
            printHelp();
            continue;
        }

        if (prompt === "/clear") {
            messages.length = 0;
            console.log(
                paint("✓ Conversation history cleared.", color.green)
            );
            continue;
        }

        if (prompt === "/status") {
            console.log();
            console.log(paint("  KERN STATUS", `${color.bold}${color.cyan}`));
            console.log(
                `${paint("  Workspace: ", color.gray)}${resolve(process.cwd())}`
            );
            console.log(
                `${paint("  Messages: ", color.gray)}${messages.length}`
            );
            console.log(
                `${paint("  Tools: ", color.gray)}${tools.map((tool) => tool.name).join(", ")}`
            );
            console.log();
            continue;
        }

        try {
            await runPrompt(prompt);
        } catch (error) {
            console.error(
                `\n${paint("✖ ERROR", color.red)} ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}

await main();