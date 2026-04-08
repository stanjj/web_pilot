import assert from "node:assert/strict";
import test from "node:test";

import { buildRegistry } from "../src/command-registrations.mjs";
import { ValidationError } from "../src/core/errors.mjs";
import {
  buildToolMap,
  buildToolsList,
  callTool,
  createSequentialToolCaller,
  isWriteCommand,
  normalizeToolArguments,
  toToolDescription,
  toToolName,
} from "../src/mcp-server.mjs";

test("toToolName normalizes site and action names for MCP", () => {
  assert.equal(toToolName("boss", "reply"), "boss_reply");
  assert.equal(toToolName("yahoo-finance", "options"), "yahoo_finance_options");
  assert.equal(toToolName("doctor", "default"), "doctor");
});

test("buildToolMap exposes the registered CLI commands as MCP tools", () => {
  const toolMap = buildToolMap(buildRegistry(), () => {});

  assert.ok(toolMap.size > 200);
  assert.ok(toolMap.has("boss_reply"));
  assert.ok(toolMap.has("yahoo_finance_options"));
  assert.ok(toolMap.has("browser_smoke"));
});

test("toToolDescription adds a warning for write commands only", () => {
  const writeDescription = toToolDescription({
    action: "reply",
    description: "Send a reply",
    usage: "node src/cli.mjs boss reply",
    name: "boss reply",
  });
  const readDescription = toToolDescription({
    action: "recent",
    description: "List recent threads",
    usage: "node src/cli.mjs boss recent",
    name: "boss recent",
  });

  assert.match(writeDescription, /write action/i);
  assert.doesNotMatch(readDescription, /write action/i);
  assert.equal(isWriteCommand({ action: "reply" }), true);
  assert.equal(isWriteCommand({ action: "recent" }), false);
});

test("normalizeToolArguments sanitizes missing or invalid MCP inputs", () => {
  assert.deepEqual(normalizeToolArguments(undefined), { flags: {}, extraArgs: [] });
  assert.deepEqual(normalizeToolArguments({ flags: null, extraArgs: "oops" }), { flags: {}, extraArgs: [] });
  assert.deepEqual(normalizeToolArguments({ flags: { symbol: "QQQ" }, extraArgs: ["one"] }), {
    flags: { symbol: "QQQ" },
    extraArgs: ["one"],
  });
});

test("buildToolsList reuses the shared generic input schema", () => {
  const toolMap = new Map([
    ["boss_reply", { action: "reply", description: "Send a reply", usage: "node src/cli.mjs boss reply", name: "boss reply" }],
  ]);

  const tools = buildToolsList(toolMap);

  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "boss_reply");
  assert.equal(tools[0].inputSchema.type, "object");
  assert.equal(typeof tools[0].inputSchema.properties.flags.description, "string");
});

test("callTool returns an MCP error response for unknown tools", async () => {
  const response = await callTool(new Map(), "missing_tool", {});

  assert.equal(response.isError, true);
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "UNKNOWN_TOOL");
});

test("callTool wraps successful command results", async () => {
  const response = await callTool(new Map([
    ["boss_recent", {
      name: "boss recent",
      handler: async (flags, extraArgs) => ({ ok: true, flags, extraArgs }),
    }],
  ]), "boss_recent", { flags: { limit: "5" }, extraArgs: ["unused"] });

  assert.equal(response.isError, false);
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.ok, true);
  assert.equal(payload.meta.command, "boss recent");
  assert.deepEqual(payload.data.flags, { limit: "5" });
  assert.deepEqual(payload.data.extraArgs, ["unused"]);
});

test("callTool wraps command failures into structured MCP errors", async () => {
  const response = await callTool(new Map([
    ["boss_reply", {
      name: "boss reply",
      handler: async () => {
        throw new ValidationError("bad input", { hint: "use --message" });
      },
    }],
  ]), "boss_reply", {});

  assert.equal(response.isError, true);
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assert.equal(payload.hint, "use --message");
  assert.equal(payload.meta.command, "boss reply");
});

test("createSequentialToolCaller serializes overlapping tool calls", async () => {
  const events = [];
  const invokeTool = createSequentialToolCaller(new Map(), async (_toolMap, name) => {
    events.push(`start:${name}`);
    await new Promise((resolve) => setTimeout(resolve, name === "first" ? 20 : 0));
    events.push(`end:${name}`);
    return { name };
  });

  const [first, second] = await Promise.all([
    invokeTool("first", {}),
    invokeTool("second", {}),
  ]);

  assert.deepEqual(events, ["start:first", "end:first", "start:second", "end:second"]);
  assert.deepEqual(first, { name: "first" });
  assert.deepEqual(second, { name: "second" });
});