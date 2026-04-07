import assert from "node:assert/strict";
import test from "node:test";

import { CommandRegistry } from "../src/core/command-registry.mjs";

test("register and resolve a command", () => {
  const reg = new CommandRegistry();
  const handler = async () => {};
  reg.register({ site: "boss", action: "search", name: "boss search", description: "Search BOSS", handler });

  const cmd = reg.resolve("boss", "search");
  assert.ok(cmd);
  assert.equal(cmd.name, "boss search");
  assert.equal(cmd.handler, handler);
});

test("resolve returns undefined for unknown command", () => {
  const reg = new CommandRegistry();
  assert.equal(reg.resolve("ghost", "cmd"), undefined);
});

test("alias resolves to canonical command", () => {
  const reg = new CommandRegistry();
  const handler = async () => {};
  reg.register({ site: "boss", action: "greet", name: "boss greet", description: "Greet", aliases: ["hello", "hi"], handler });

  const cmd = reg.resolve("boss", "hello");
  assert.ok(cmd);
  assert.equal(cmd.action, "greet");

  const cmd2 = reg.resolve("boss", "hi");
  assert.ok(cmd2);
  assert.equal(cmd2.action, "greet");
});

test("duplicate registration throws", () => {
  const reg = new CommandRegistry();
  const handler = async () => {};
  reg.register({ site: "boss", action: "search", name: "boss search", description: "Search", handler });

  assert.throws(
    () => reg.register({ site: "boss", action: "search", name: "boss search", description: "Dup", handler }),
    /Duplicate command registration: boss:search/,
  );
});

test("alias collision with existing command throws", () => {
  const reg = new CommandRegistry();
  const handler = async () => {};
  reg.register({ site: "boss", action: "search", name: "boss search", description: "S1", handler });

  assert.throws(
    () => reg.register({ site: "boss", action: "find", name: "boss find", description: "S2", aliases: ["search"], handler }),
    /Alias collision: boss:search/,
  );
});

test("alias collision with existing alias throws", () => {
  const reg = new CommandRegistry();
  const handler = async () => {};
  reg.register({ site: "boss", action: "greet", name: "boss greet", description: "G1", aliases: ["hello"], handler });

  assert.throws(
    () => reg.register({ site: "boss", action: "wave", name: "boss wave", description: "G2", aliases: ["hello"], handler }),
    /Alias collision: boss:hello/,
  );
});

test("listAll returns all registered commands", () => {
  const reg = new CommandRegistry();
  const handler = async () => {};
  reg.register({ site: "boss", action: "search", name: "boss search", description: "S", handler });
  reg.register({ site: "boss", action: "greet", name: "boss greet", description: "G", handler });
  reg.register({ site: "twitter", action: "hot", name: "twitter hot", description: "H", handler });

  assert.equal(reg.listAll().length, 3);
  assert.equal(reg.size, 3);
});

test("listBySite filters by site name", () => {
  const reg = new CommandRegistry();
  const handler = async () => {};
  reg.register({ site: "boss", action: "search", name: "boss search", description: "S", handler });
  reg.register({ site: "boss", action: "greet", name: "boss greet", description: "G", handler });
  reg.register({ site: "twitter", action: "hot", name: "twitter hot", description: "H", handler });

  const bossCommands = reg.listBySite("boss");
  assert.equal(bossCommands.length, 2);
  assert.ok(bossCommands.every((c) => c.site === "boss"));
});

test("CommandRegistry.key produces consistent keys", () => {
  assert.equal(CommandRegistry.key("boss", "search"), "boss:search");
  assert.equal(CommandRegistry.key("yahoo-finance", "quote"), "yahoo-finance:quote");
});
