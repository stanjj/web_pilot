import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { generateStealthJs, injectStealth, GUARD_KEY } from "../src/core/stealth.mjs";

function createExecutionHarness() {
  const scheduled = [];
  const navigator = {
    languages: [],
    plugins: { length: 0 },
    permissions: {
      query(desc) {
        return Promise.resolve({ state: desc?.name === "notifications" ? "prompt" : "granted" });
      },
    },
  };
  const document = {
    documentElement: {},
    body: {},
    createElement(tag) {
      const listeners = new Map();
      return {
        tagName: String(tag).toUpperCase(),
        addEventListener(type, handler) {
          listeners.set(type, handler);
        },
        fire(type) {
          const handler = listeners.get(type);
          if (handler) handler();
        },
        contentWindow: {
          navigator: {},
          chrome: undefined,
        },
      };
    },
  };
  const performance = {
    getEntries() {
      return [{ name: "app-entry" }, { name: "playwright-noise" }];
    },
    getEntriesByType(type) {
      return [{ name: `${type}-entry` }, { name: "devtools://devtools/bundled" }];
    },
    getEntriesByName(name) {
      return [{ name }, { name: "__cdp_marker" }];
    },
  };
  const consoleObject = {
    log() {},
    warn() {},
    error() {},
    info() {},
    debug() {},
    table() {},
    dir() {},
  };
  const windowLike = {
    console: consoleObject,
    document,
    navigator,
    Notification: { permission: "granted" },
    performance,
    PerformanceObserver: class {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    Element: class {},
    setTimeout(fn) {
      scheduled.push(fn);
      return scheduled.length;
    },
    clearTimeout() {},
    innerWidth: 1200,
    innerHeight: 900,
  };

  Object.defineProperty(windowLike, "window", { value: windowLike, configurable: true });
  Object.defineProperty(windowLike, "globalThis", { value: windowLike, configurable: true });
  Object.defineProperty(windowLike, "navigator", { value: navigator, configurable: true });
  Object.defineProperty(windowLike, "document", { value: document, configurable: true });
  Object.defineProperty(windowLike, "outerWidth", {
    configurable: true,
    get() {
      return 1901;
    },
  });
  Object.defineProperty(windowLike, "outerHeight", {
    configurable: true,
    get() {
      return 1501;
    },
  });

  return {
    context: vm.createContext(windowLike),
    scheduled,
    windowLike,
    document,
  };
}

function flushScheduled(queue) {
  while (queue.length > 0) {
    const task = queue.shift();
    task();
  }
}

function runGeneratedJs(context) {
  return vm.runInContext(generateStealthJs(), context);
}

// ---------------------------------------------------------------------------
// generateStealthJs() tests
// ---------------------------------------------------------------------------

describe("generateStealthJs()", () => {
  const js = generateStealthJs();

  it("returns a non-empty string", () => {
    assert.ok(typeof js === "string" && js.length > 0);
  });

  it("contains the guard key", () => {
    assert.ok(js.includes(GUARD_KEY));
  });

  it("guard appears before main patch bodies", () => {
    const guardIdx = js.indexOf(GUARD_KEY);
    const navigatorIdx = js.indexOf("navigator.webdriver");
    assert.ok(guardIdx < navigatorIdx, "guard key must precede navigator.webdriver patch");
  });

  it("is valid JS syntax (new Function does not throw)", () => {
    assert.doesNotThrow(() => new Function(js));
  });

  it("executes without runtime errors in a mocked browser context", () => {
    const harness = createExecutionHarness();
    assert.doesNotThrow(() => {
      runGeneratedJs(harness.context);
      flushScheduled(harness.scheduled);
    });
  });

  it("is safe to execute multiple times on the same page", () => {
    const harness = createExecutionHarness();
    assert.doesNotThrow(() => {
      runGeneratedJs(harness.context);
      runGeneratedJs(harness.context);
      flushScheduled(harness.scheduled);
    });
    assert.strictEqual(vm.runInContext(`window["${GUARD_KEY}"]`, harness.context), true);
  });

  it("patches webdriver, permissions, artifacts, and performance queries conservatively", async () => {
    const harness = createExecutionHarness();
    harness.windowLike.__playwright = true;
    harness.windowLike.cdc_foo = true;
    harness.document.$cdc_bar = true;

    runGeneratedJs(harness.context);
    flushScheduled(harness.scheduled);

    assert.strictEqual(vm.runInContext("navigator.webdriver", harness.context), false);
    assert.strictEqual(
      await vm.runInContext('navigator.permissions.query({ name: "notifications" }).then((result) => result.state)', harness.context),
      "granted",
    );
    assert.strictEqual(
      await vm.runInContext('navigator.permissions.query({ name: "geolocation" }).then((result) => result.state)', harness.context),
      "granted",
    );
    assert.deepStrictEqual(
      vm.runInContext('performance.getEntriesByName("devtools-perf").map((entry) => entry.name)', harness.context),
      ["devtools-perf"],
    );
    assert.strictEqual(vm.runInContext("window.outerWidth", harness.context), 1200);
    assert.strictEqual(vm.runInContext("window.outerHeight", harness.context), 900);
    assert.strictEqual("__playwright" in harness.windowLike, false);
    assert.strictEqual("cdc_foo" in harness.windowLike, false);
    assert.strictEqual("$cdc_bar" in harness.document, false);
  });

  it("normalizes iframe contentWindow state and strips bare debugger statements from Function source", () => {
    const harness = createExecutionHarness();
    runGeneratedJs(harness.context);

    const iframe = harness.document.createElement("iframe");
    flushScheduled(harness.scheduled);
    iframe.fire("load");

    assert.strictEqual(iframe.contentWindow.navigator.webdriver, false);
    assert.strictEqual(iframe.contentWindow.chrome, harness.windowLike.chrome);
    assert.strictEqual(
      vm.runInContext('Function("debugger; return 42").toString().includes("debugger")', harness.context),
      false,
    );
  });

  it("contains navigator.webdriver patch", () => {
    assert.ok(js.includes("navigator.webdriver") || js.includes('navigator, "webdriver"'));
  });

  it("contains window.chrome stub", () => {
    assert.ok(js.includes("window.chrome"));
  });

  it("contains navigator.plugins patch", () => {
    assert.ok(js.includes("navigator.plugins") || js.includes('navigator, "plugins"'));
  });

  it("contains navigator.languages patch", () => {
    assert.ok(js.includes("navigator.languages") || js.includes('navigator, "languages"'));
  });

  it("contains Permissions.query patch", () => {
    assert.ok(js.includes("Permissions"));
  });

  it("contains automation artifact cleanup", () => {
    assert.ok(js.includes("__playwright"));
    assert.ok(js.includes("cdc_"));
  });

  it("contains Error.stack cleanup", () => {
    assert.ok(js.includes("Error.prototype") || js.includes("prepareStackTrace"));
  });

  it("contains dynamic code defense", () => {
    assert.ok(js.includes("debugger"));
  });

  it("contains console defense", () => {
    assert.ok(js.includes("console"));
  });

  it("contains window dimensions defense", () => {
    assert.ok(js.includes("outerWidth") || js.includes("outerHeight"));
  });

  it("contains performance API cleanup", () => {
    assert.ok(js.includes("getEntries") || js.includes("performance"));
  });

  it("contains iframe patch", () => {
    assert.ok(js.includes("iframe") || js.includes("createElement"));
  });

  it("contains toString disguise infrastructure", () => {
    assert.ok(js.includes("_disguised") || js.includes("disguise"));
  });
});

// ---------------------------------------------------------------------------
// injectStealth() tests
// ---------------------------------------------------------------------------

function makeFakeClient({ persistFail = false, immediateFail = false } = {}) {
  const calls = [];
  return {
    calls,
    send: mock.fn(async (method, params) => {
      calls.push({ method, params });
      if (method === "Page.addScriptToEvaluateOnNewDocument" && persistFail) {
        throw new Error("persistent injection simulated failure");
      }
      if (method === "Runtime.evaluate" && immediateFail) {
        throw new Error("immediate injection simulated failure");
      }
      return {};
    }),
  };
}

describe("injectStealth()", () => {
  it("calls Page.addScriptToEvaluateOnNewDocument", async () => {
    const client = makeFakeClient();
    await injectStealth(client);
    const found = client.calls.some((c) => c.method === "Page.addScriptToEvaluateOnNewDocument");
    assert.ok(found, "must call Page.addScriptToEvaluateOnNewDocument");
  });

  it("calls Runtime.evaluate", async () => {
    const client = makeFakeClient();
    await injectStealth(client);
    const found = client.calls.some((c) => c.method === "Runtime.evaluate");
    assert.ok(found, "must call Runtime.evaluate");
  });

  it("returns ok: true when both succeed", async () => {
    const client = makeFakeClient();
    const result = await injectStealth(client);
    assert.deepStrictEqual(result, {
      ok: true,
      persistent: true,
      immediate: true,
      warnings: [],
    });
  });

  it("tolerates persistent injection failure", async () => {
    const client = makeFakeClient({ persistFail: true });
    const result = await injectStealth(client);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.persistent, false);
    assert.strictEqual(result.immediate, true);
    assert.ok(result.warnings.length > 0);
  });

  it("tolerates immediate injection failure", async () => {
    const client = makeFakeClient({ immediateFail: true });
    const result = await injectStealth(client);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.persistent, true);
    assert.strictEqual(result.immediate, false);
    assert.ok(result.warnings.length > 0);
  });

  it("throws when both injections fail", async () => {
    const client = makeFakeClient({ persistFail: true, immediateFail: true });
    await assert.rejects(
      () => injectStealth(client),
      (err) => {
        assert.strictEqual(err.code, "STEALTH_INJECTION_FAILED");
        assert.ok(Array.isArray(err.warnings));
        assert.ok(err.warnings.length === 2);
        return true;
      },
    );
  });

  it("passes JS source in the correct params shape", async () => {
    const client = makeFakeClient();
    await injectStealth(client);
    const persistCall = client.calls.find((c) => c.method === "Page.addScriptToEvaluateOnNewDocument");
    assert.ok(typeof persistCall.params.source === "string");
    assert.ok(persistCall.params.source.length > 0);

    const evalCall = client.calls.find((c) => c.method === "Runtime.evaluate");
    assert.ok(typeof evalCall.params.expression === "string");
    assert.ok(evalCall.params.expression.length > 0);
  });
});
