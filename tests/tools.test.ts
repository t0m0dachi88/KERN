
import { test } from "node:test";
import assert from "node:assert/strict";
import { tools } from "../src/tools/index.js";

test("all registered tools have valid interfaces", () => {
  assert.ok(tools.length > 0, "At least one tool should be registered");

  const names = tools.map((tool) => tool.name);

  assert.equal(
    new Set(names).size,
    names.length,
    "Tool names must be unique",
  );

  for (const tool of tools) {
    assert.equal(typeof tool.name, "string");
    assert.ok(tool.name.length > 0);
    assert.equal(typeof tool.description, "string");
    assert.equal(typeof tool.execute, "function");
    assert.equal(typeof tool.parameters, "object");
    assert.ok(tool.parameters !== null);
  }
});