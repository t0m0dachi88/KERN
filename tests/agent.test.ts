import { test } from "node:test";
import assert from "node:assert/strict";

import { runAgent } from "../src/agent/agent.js";
import type {
  AgentEvent,
  LLMChunk,
  LLMProvider,
  Message,
  Tool,
} from "../src/types.js";

// A provider that replays a fixed script of turns. Each entry in `turns`
// becomes one generateResponse() call, so tests are fully deterministic
// and never touch a real LLM API. Each call also snapshots the message
// history it received, so tests can assert what the "model" saw.
type RecordedCall = { messages: Message[]; tools: Tool[] };

type ScriptedProvider = LLMProvider & { calls: RecordedCall[] };

function scriptedProvider(turns: LLMChunk[][]): ScriptedProvider {
  const calls: RecordedCall[] = [];
  let next = 0;

  return {
    calls,
    generateResponse(messages, tools) {
      calls.push({
        messages: JSON.parse(JSON.stringify(messages)) as Message[],
        tools: [...tools],
      });

      const chunks = turns[next] ?? [{ content: "(script exhausted)" }];
      next += 1;

      return (async function* () {
        yield* chunks;
      })();
    },
  };
}

function makeTool(
  name: string,
  handler: (args: Record<string, unknown>) => string,
): Tool {
  return {
    name,
    description: `Test tool ${name}`,
    parameters: { type: "object", properties: {} },
    execute: async (args) => handler(args),
  };
}

function collectEvents(): {
  events: AgentEvent[];
  onEvent: (event: AgentEvent) => void;
} {
  const events: AgentEvent[] = [];
  return {
    events,
    onEvent: (event) => {
      events.push(event);
    },
  };
}

function eventTypes(events: AgentEvent[]): string[] {
  return events.map((event) => event.type);
}

function lastDone(
  events: AgentEvent[],
): Extract<AgentEvent, { type: "done" }> | undefined {
  const last = events[events.length - 1];
  return last?.type === "done" ? last : undefined;
}

function toolResults(events: AgentEvent[]): string[] {
  return events
    .filter((event): event is Extract<AgentEvent, { type: "tool_result" }> =>
      event.type === "tool_result"
    )
    .map((event) => event.result);
}

test("scenario 1: final response without tool calls completes successfully", async () => {
  const provider = scriptedProvider([
    [{ content: "Hello " }, { content: "world." }],
  ]);
  const messages: Message[] = [{ role: "user", content: "Say hello" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [], onEvent);

  assert.deepEqual(eventTypes(events), ["text", "text", "done"]);
  assert.deepEqual(lastDone(events), { type: "done", status: "success" });
  assert.equal(provider.calls.length, 1);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[1], {
    role: "assistant",
    content: "Hello world.",
  });
});

test("scenario 2: tool call is executed, its result reaches the model, then the agent finishes", async () => {
  const executedArgs: Record<string, unknown>[] = [];
  const echo = makeTool("echo", (args) => {
    executedArgs.push(args);
    return `echoed: ${String(args.text)}`;
  });

  const provider = scriptedProvider([
    [{ toolCalls: [{ id: "call_1", name: "echo", arguments: '{"text":"hi"}' }] }],
    [{ content: "The tool said hi." }],
  ]);

  const messages: Message[] = [{ role: "user", content: "Echo hi" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [echo], onEvent);

  assert.deepEqual(eventTypes(events), [
    "tool_call",
    "tool_result",
    "text",
    "done",
  ]);
  assert.deepEqual(lastDone(events), { type: "done", status: "success" });

  // The tool ran once, with JSON arguments parsed into an object.
  assert.deepEqual(executedArgs, [{ text: "hi" }]);

  // The registry tools were forwarded to the model.
  assert.deepEqual(
    provider.calls[0].tools.map((tool) => tool.name),
    ["echo"]
  );

  // History: user -> assistant(tool_calls) -> tool(result) -> assistant(final).
  assert.equal(messages.length, 4);

  const callMessage = messages[1];
  assert.ok(callMessage.role === "assistant");
  assert.ok(callMessage.tool_calls);
  assert.equal(callMessage.tool_calls[0].id, "call_1");
  assert.equal(callMessage.tool_calls[0].function.name, "echo");

  assert.deepEqual(messages[2], {
    role: "tool",
    tool_call_id: "call_1",
    content: "echoed: hi",
  });
  assert.deepEqual(messages[3], {
    role: "assistant",
    content: "The tool said hi.",
  });

  // The second model turn saw the tool result at the end of the history.
  const secondTurnHistory = provider.calls[1].messages;
  assert.deepEqual(secondTurnHistory[secondTurnHistory.length - 1], {
    role: "tool",
    tool_call_id: "call_1",
    content: "echoed: hi",
  });
});

test("scenario 3: multiple tool calls across successive turns all execute and are fed back", async () => {
  const order: string[] = [];
  const first = makeTool("first", () => {
    order.push("first");
    return "first result";
  });
  const second = makeTool("second", (args) => {
    order.push(`second:${String(args.seed)}`);
    return "second result";
  });

  const provider = scriptedProvider([
    // Turn 1: two tool calls accumulated across two stream chunks.
    [
      { toolCalls: [{ id: "c1", name: "first", arguments: "{}" }] },
      { toolCalls: [{ id: "c2", name: "second", arguments: '{"seed":7}' }] },
    ],
    // Turn 2: one more tool call in a new turn.
    [{ toolCalls: [{ id: "c3", name: "first", arguments: "{}" }] }],
    // Turn 3: final response.
    [{ content: "All tools ran." }],
  ]);

  const messages: Message[] = [{ role: "user", content: "Run everything" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [first, second], onEvent);

  assert.deepEqual(order, ["first", "second:7", "first"]);
  assert.deepEqual(eventTypes(events), [
    "tool_call",
    "tool_result",
    "tool_call",
    "tool_result",
    "tool_call",
    "tool_result",
    "text",
    "done",
  ]);
  assert.deepEqual(lastDone(events), { type: "done", status: "success" });

  // user + 3 assistant tool-call turns + 3 tool results + 1 final assistant.
  assert.equal(messages.length, 7);

  // Every tool result is paired with the correct tool-call ID.
  const resultIds = messages
    .filter((message) => message.role === "tool")
    .map((message) =>
      message.role === "tool" ? `${message.tool_call_id}:${message.content}` : ""
    );
  assert.deepEqual(resultIds, [
    "c1:first result",
    "c2:second result",
    "c3:first result",
  ]);

  // By the third turn the model had seen all three results in order.
  const thirdTurnHistory = provider.calls[2].messages;
  const seenResults = thirdTurnHistory
    .filter((message) => message.role === "tool")
    .map((message) => message.content);
  assert.deepEqual(seenResults, [
    "first result",
    "second result",
    "first result",
  ]);
});

test("scenario 4a: unknown tool name is fed back as a result and the agent keeps going", async () => {
  const provider = scriptedProvider([
    [{ toolCalls: [{ id: "x1", name: "nope", arguments: "{}" }] }],
    [{ content: "Recovered." }],
  ]);

  const messages: Message[] = [{ role: "user", content: "Try an unknown tool" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [], onEvent);

  assert.deepEqual(toolResults(events), ["Unknown tool: nope"]);
  assert.deepEqual(lastDone(events), { type: "done", status: "success" });
  assert.equal(messages[2].content, "Unknown tool: nope");
});

test("scenario 4b: malformed tool-call arguments abort the run with a validation error", async () => {
  let executed = false;
  const echo = makeTool("echo", () => {
    executed = true;
    return "should not run";
  });

  const provider = scriptedProvider([
    [{ toolCalls: [{ id: "bad", name: "echo", arguments: "{not json" }] }],
    [{ content: "should not happen" }],
  ]);

  const messages: Message[] = [{ role: "user", content: "Break the JSON" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [echo], onEvent);

  assert.equal(executed, false, "the tool must not execute");
  assert.equal(provider.calls.length, 1, "the model must not be called again");
  assert.deepEqual(eventTypes(events), ["error", "done"]);

  const error = events[0];
  assert.ok(error && error.type === "error");
  assert.match(error.message, /malformed JSON/);
  assert.deepEqual(lastDone(events), { type: "done", status: "error" });
  assert.equal(messages.length, 1, "nothing is recorded after a validation failure");
});

test("scenario 4c: duplicate tool-call IDs are rejected by validation", async () => {
  let executed = false;
  const echo = makeTool("echo", () => {
    executed = true;
    return "should not run";
  });

  const provider = scriptedProvider([
    [
      {
        toolCalls: [
          { id: "dup", name: "echo", arguments: "{}" },
          { id: "dup", name: "echo", arguments: "{}" },
        ],
      },
    ],
  ]);

  const messages: Message[] = [{ role: "user", content: "Duplicate IDs" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [echo], onEvent);

  assert.equal(executed, false);

  const error = events[0];
  assert.ok(error && error.type === "error");
  assert.match(error.message, /Duplicate tool-call ID: dup/);
  assert.deepEqual(lastDone(events), { type: "done", status: "error" });
});

test("scenario 5: a throwing tool becomes an error result and the agent continues", async () => {
  const boom = makeTool("boom", () => {
    throw new Error("kaboom");
  });
  const safe = makeTool("safe", () => "still fine");

  const provider = scriptedProvider([
    [{ toolCalls: [{ id: "t1", name: "boom", arguments: "{}" }] }],
    [{ toolCalls: [{ id: "t2", name: "safe", arguments: "{}" }] }],
    [{ content: "Recovered after the failure." }],
  ]);

  const messages: Message[] = [{ role: "user", content: "Run the failing tool" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [boom, safe], onEvent);

  // The failure is captured as a tool result, not a crash, and no
  // agent-level error event is produced.
  assert.deepEqual(toolResults(events), [
    "Tool error: kaboom",
    "still fine",
  ]);
  assert.deepEqual(eventTypes(events), [
    "tool_call",
    "tool_result",
    "tool_call",
    "tool_result",
    "text",
    "done",
  ]);
  assert.deepEqual(lastDone(events), { type: "done", status: "success" });

  // user + 2 assistant tool-call turns + 2 tool results + final assistant.
  assert.equal(messages.length, 6);
  assert.match(messages[2].content ?? "", /kaboom/);
});

test("extra: the agent stops with an error after exhausting its turn limit", async () => {
  let calls = 0;
  const loop = makeTool("loop", () => {
    calls += 1;
    return "again";
  });

  // A provider that always asks for one more tool call.
  const provider = scriptedProvider(
    Array.from({ length: 10 }, (_, index) => [
      { toolCalls: [{ id: `c${index}`, name: "loop", arguments: "{}" }] },
    ])
  );

  const messages: Message[] = [{ role: "user", content: "Loop forever" }];
  const { events, onEvent } = collectEvents();

  await runAgent(provider, messages, [loop], onEvent);

  assert.equal(calls, 10);
  assert.equal(provider.calls.length, 10);

  const error = events.find(
    (event): event is Extract<AgentEvent, { type: "error" }> =>
      event.type === "error"
  );
  assert.ok(error);
  assert.match(error.message, /maximum of 10 turns/);
  assert.deepEqual(lastDone(events), { type: "done", status: "error" });
});
