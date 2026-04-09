import assert from "node:assert/strict";
import test from "node:test";

import { runBossTriage } from "../src/sites/boss/triage.mjs";

function createHarness(overrides = {}) {
  const writes = [];
  const state = {
    closeCalls: 0,
    port: undefined,
    navigateCalls: [],
    readyCalls: [],
    selectArgs: undefined,
    waitArgs: undefined,
    readArgs: undefined,
  };

  const client = {
    async close() {
      state.closeCalls += 1;
    },
  };

  const snapshot = {
    ok: true,
    items: [
      {
        index: 1,
        name: "Alice",
        company: "Acme",
        title: "Backend Engineer",
        message: "已收到，稍后回复您",
        time: "09:00",
        statusClass: "message-status status-read",
      },
      {
        index: 7,
        name: "Carol",
        company: "Gamma",
        title: "Platform Lead",
        message: "方便聊一下岗位吗",
        time: "10:00",
        statusClass: "",
      },
      {
        index: 8,
        name: "Dan",
        company: "Delta",
        title: "Staff Engineer",
        message: "在吗",
        time: "10:30",
        statusClass: "",
      },
    ],
  };

  const deps = {
    async connectBossPage(port) {
      state.port = port;
      return { client };
    },
    async navigate(...args) {
      state.navigateCalls.push(args);
    },
    async ensureBossPageReady(...args) {
      state.readyCalls.push(args);
    },
    async fetchInboxSnapshot() {
      return snapshot;
    },
    async selectBossThread(receivedClient, selection) {
      state.selectArgs = { receivedClient, selection };
      return {
        ok: true,
        expected: {
          name: "Carol",
          company: "Gamma",
          title: "Platform Lead",
        },
      };
    },
    async waitForSelectedBossThread(receivedClient, expected) {
      state.waitArgs = { receivedClient, expected };
      return expected;
    },
    async readOpenThread(receivedClient, maxMessages) {
      state.readArgs = { receivedClient, maxMessages };
      return {
        ok: true,
        contact: {
          name: "Carol",
          company: "Gamma",
          title: "Platform Lead",
        },
        position: {
          name: "Senior Platform Engineer",
          salary: "30-50K",
        },
        messages: [
          { sender: "friend", time: "09:59", text: "方便聊一下岗位吗" },
          { sender: "me", time: "10:02", text: "可以，方便介绍一下 JD 吗？" },
        ],
      };
    },
    writeOutput(chunk) {
      writes.push(typeof chunk === "string" ? chunk : String(chunk));
      return true;
    },
    ...overrides,
  };

  return { client, deps, snapshot, state, writes };
}

function parseOutput(writes) {
  return JSON.parse(writes.join(""));
}

test("runBossTriage opens the top reply-needed thread and returns reply context", async () => {
  const { client, deps, state, writes } = createHarness();

  const result = await runBossTriage({ port: "9555", messages: "3" }, deps);

  assert.equal(state.port, 9555);
  assert.equal(state.closeCalls, 1);
  assert.equal(state.navigateCalls.length, 1);
  assert.equal(state.navigateCalls[0][0], client);
  assert.equal(state.navigateCalls[0][1], "https://www.zhipin.com/web/geek/chat");
  assert.equal(state.navigateCalls[0][2], 3000);
  assert.equal(state.readyCalls.length, 1);
  assert.deepEqual(state.selectArgs.selection, { index: 7 });
  assert.equal(state.waitArgs.receivedClient, client);
  assert.equal(state.readArgs.maxMessages, 3);
  assert.equal(result.ok, true);
  assert.equal(result.needsReplyCount, 2);
  assert.deepEqual(result.openedThread, {
    index: 7,
    name: "Carol",
    company: "Gamma",
    title: "Platform Lead",
    lastMessage: "方便聊一下岗位吗",
    time: "10:00",
  });
  assert.deepEqual(result.contact, {
    name: "Carol",
    company: "Gamma",
    title: "Platform Lead",
  });
  assert.deepEqual(result.position, {
    name: "Senior Platform Engineer",
    salary: "30-50K",
  });
  assert.equal(result.recentMessages.length, 2);
  assert.deepEqual(result.otherNeedsReply, [
    {
      index: 8,
      name: "Dan",
      company: "Delta",
      message: "在吗",
    },
  ]);
  assert.equal(
    result.nextStep,
    'node src/cli.mjs boss reply --index 7 --message "..." --dry-run --port 9555',
  );
  assert.deepEqual(parseOutput(writes), result);
});

test("runBossTriage returns early when no threads need a reply", async () => {
  const { deps, state, writes } = createHarness({
    async fetchInboxSnapshot() {
      return {
        ok: true,
        items: [
          {
            index: 1,
            name: "Alice",
            company: "Acme",
            title: "Backend Engineer",
            message: "已收到，稍后回复您",
            statusClass: "message-status status-read",
          },
          {
            index: 2,
            name: "Boss Zhang",
            company: "Beta Cloud",
            title: "Staff Engineer",
            message: "您正在与Boss张三沟通",
            statusClass: "",
          },
        ],
      };
    },
  });

  const result = await runBossTriage({}, deps);

  assert.equal(state.closeCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.needsReplyCount, 0);
  assert.equal(result.message, "No threads need a reply right now.");
  assert.deepEqual(result.threads, []);
  assert.equal(state.selectArgs, undefined);
  assert.deepEqual(parseOutput(writes), result);
});

test("runBossTriage still returns early when it has to lazy-load missing runtime deps", async () => {
  const { deps, state, writes } = createHarness({
    async fetchInboxSnapshot() {
      return {
        ok: true,
        items: [
          {
            index: 1,
            name: "Alice",
            company: "Acme",
            title: "Backend Engineer",
            message: "已收到，稍后回复您",
            statusClass: "message-status status-read",
          },
        ],
      };
    },
  });

  delete deps.readOpenThread;

  const result = await runBossTriage({}, deps);

  assert.equal(state.closeCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.needsReplyCount, 0);
  assert.equal(result.message, "No threads need a reply right now.");
  assert.equal(state.selectArgs, undefined);
  assert.deepEqual(parseOutput(writes), result);
});

test("runBossTriage falls back to default port and message limit for invalid flags", async () => {
  const { deps, state } = createHarness();

  const result = await runBossTriage({ port: "not-a-port", messages: "NaN" }, deps);

  assert.equal(state.port, 9223);
  assert.equal(state.readArgs.maxMessages, 10);
  assert.match(result.nextStep, /--port 9223$/);
});

test("runBossTriage surfaces inbox snapshot failures", async () => {
  const { deps, state, writes } = createHarness({
    async fetchInboxSnapshot() {
      return { ok: false, error: "Failed to read BOSS inbox snapshot" };
    },
  });

  await assert.rejects(
    runBossTriage({}, deps),
    /Failed to read BOSS inbox snapshot/,
  );

  assert.equal(state.closeCalls, 1);
  assert.deepEqual(writes, []);
});

test("runBossTriage formats thread selection failures with candidate identities", async () => {
  const { deps, state, writes } = createHarness({
    async selectBossThread() {
      return {
        ok: false,
        error: "Ambiguous thread selector: Carol",
        candidates: [
          {
            domIndex: 7,
            name: "Carol",
            company: "Gamma",
            title: "Platform Lead",
          },
        ],
      };
    },
  });

  await assert.rejects(
    runBossTriage({}, deps),
    /Candidates: \[7\] Carol \/ Gamma \/ Platform Lead/,
  );

  assert.equal(state.closeCalls, 1);
  assert.deepEqual(writes, []);
});

test("runBossTriage fails when the selected thread never settles", async () => {
  const { deps, state } = createHarness({
    async waitForSelectedBossThread() {
      return null;
    },
  });

  await assert.rejects(
    runBossTriage({}, deps),
    /Could not open thread: Carol/,
  );

  assert.equal(state.closeCalls, 1);
});

test("runBossTriage surfaces thread read failures after opening the conversation", async () => {
  const { deps, state, writes } = createHarness({
    async readOpenThread() {
      return { ok: false, error: "Conversation panel not found" };
    },
  });

  await assert.rejects(
    runBossTriage({}, deps),
    /Conversation panel not found/,
  );

  assert.equal(state.closeCalls, 1);
  assert.deepEqual(writes, []);
});