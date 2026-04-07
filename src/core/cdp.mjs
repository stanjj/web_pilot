import { getTabOverflow, selectTargetsForClosure } from "./tab-policy.mjs";
import { injectStealth } from "./stealth.mjs";

const DEFAULT_PORT = 9223;
const DEFAULT_MAX_PAGE_TABS = 15;
const DEFAULT_CDP_HTTP_TIMEOUT_MS = 2000;
const DEFAULT_CDP_CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_CDP_SEND_TIMEOUT_MS = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeTimeoutError(message) {
  const error = new Error(message);
  error.code = "TIMEOUT";
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_CDP_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw makeTimeoutError(`CDP HTTP request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJsonWithTimeout(response, timeoutMs, url) {
  let timeoutId = null;

  try {
    return await Promise.race([
      response.json(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(makeTimeoutError(`CDP HTTP response body timed out after ${timeoutMs}ms: ${url}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * List all CDP targets (pages, workers, etc.) on the given port.
 * @param {number} [port=9223]
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<Array<{id: string, type: string, url: string, title: string, webSocketDebuggerUrl?: string}>>}
 * @throws {Error} If the CDP HTTP request fails or times out.
 */
export async function listTargets(port = DEFAULT_PORT, timeoutMs = DEFAULT_CDP_HTTP_TIMEOUT_MS) {
  const url = `http://127.0.0.1:${port}/json/list`;
  const res = await fetchWithTimeout(url, {}, timeoutMs);
  if (!res.ok) {
    throw new Error(`CDP target list failed: HTTP ${res.status}`);
  }
  return readJsonWithTimeout(res, timeoutMs, url);
}

function getMaxPageTabs() {
  const raw = Number(process.env.CDP_EVERYTHING_MAX_TABS ?? DEFAULT_MAX_PAGE_TABS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_PAGE_TABS;
}

function getClosablePageTargets(targets) {
  return targets.filter((target) => {
    if (target?.type !== "page") return false;
    const url = String(target?.url || "");
    if (!url) return false;
    if (url.startsWith("devtools://")) return false;
    if (url.startsWith("chrome://")) return false;
    return true;
  });
}

/**
 * Close a CDP target by its id.
 * @param {string} targetId
 * @param {number} [port=9223]
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<boolean>} True if the target was closed successfully.
 */
export async function closeTarget(targetId, port = DEFAULT_PORT, timeoutMs = DEFAULT_CDP_HTTP_TIMEOUT_MS) {
  if (!targetId) return false;
  const res = await fetchWithTimeout(`http://127.0.0.1:${port}/json/close/${targetId}`, {}, timeoutMs);
  return res.ok;
}

async function inspectTargetLastLoadedAt(target) {
  if (!target?.webSocketDebuggerUrl) return null;

  const client = new CdpClient(target.webSocketDebuggerUrl);

  try {
    await client.connect(1500);
    await client.send("Runtime.enable", {}, 1500);
    const result = await client.send("Runtime.evaluate", {
      expression: "(() => Number(performance.timeOrigin || performance.timing?.navigationStart || 0))()",
      awaitPromise: true,
      returnByValue: true,
    }, 1500);

    const value = Number(result?.result?.value);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  } finally {
    await client.close(500).catch(() => {});
  }
}

async function inspectClosableTargets(targets) {
  return Promise.all(
    targets.map(async (target, originalIndex) => ({
      ...target,
      originalIndex,
      lastLoadedAt: await inspectTargetLastLoadedAt(target),
    })),
  );
}

async function waitForTabCapacity(port, incomingTabs, maxTabs, attempts = 5, delayMs = 200) {
  let lastPages = [];
  let remainingOverflow = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(delayMs);
    }

    const currentTargets = await listTargets(port);
    lastPages = getClosablePageTargets(currentTargets);
    remainingOverflow = getTabOverflow(lastPages.length, incomingTabs, maxTabs);
    if (remainingOverflow <= 0) {
      break;
    }
  }

  return { pages: lastPages, remainingOverflow };
}

/**
 * Enforce the maximum number of open page tabs, closing oldest if needed.
 * @param {number} [port=9223]
 * @param {number} [incomingTabs=1] - Number of new tabs about to be opened.
 * @returns {Promise<{ok: boolean, closed: number, requiredClosed: number, maxTabs: number, before: number, after: number, remainingOverflow: number, closeErrors: Array}>}
 */
export async function enforcePageTargetLimit(port = DEFAULT_PORT, incomingTabs = 1) {
  const maxTabs = getMaxPageTabs();
  const targets = await listTargets(port);
  const pages = getClosablePageTargets(targets);
  const overflow = getTabOverflow(pages.length, incomingTabs, maxTabs);

  if (overflow <= 0) {
    return { ok: true, closed: 0, requiredClosed: 0, maxTabs, before: pages.length, after: pages.length, remainingOverflow: 0, closeErrors: [] };
  }

  const closePlan = selectTargetsForClosure(await inspectClosableTargets(pages), overflow);
  let closed = 0;
  const closeErrors = [];

  for (const target of closePlan) {
    try {
      const didClose = await closeTarget(target.id, port);
      if (didClose) closed += 1;
      else {
        closeErrors.push({ targetId: target.id, error: "CDP close returned a non-ok response" });
      }
    } catch (error) {
      closeErrors.push({
        targetId: target.id,
        error: error?.message || String(error),
      });
    }
  }

  const { pages: afterPages, remainingOverflow } = await waitForTabCapacity(port, incomingTabs, maxTabs);

  return {
    ok: remainingOverflow <= 0,
    closed,
    requiredClosed: overflow,
    maxTabs,
    before: pages.length,
    after: afterPages.length,
    remainingOverflow,
    closeErrors,
  };
}

/**
 * Create a new browser tab with the given URL, enforcing tab limits.
 * @param {string} url - URL to open in the new tab.
 * @param {number} [port=9223]
 * @returns {Promise<{id: string, type: string, url: string, webSocketDebuggerUrl: string}>}
 * @throws {Error} If tab capacity cannot be freed or the CDP request fails.
 */
export async function createTarget(url, port = DEFAULT_PORT) {
  const enforcement = await enforcePageTargetLimit(port, 1);
  if (!enforcement.ok) {
    throw new Error(
      `Unable to free tab capacity on port ${port}: closed ${enforcement.closed}/${enforcement.requiredClosed} required tab(s)`,
    );
  }

  const requestUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(requestUrl, {
    method: "PUT",
  });
  if (!res.ok) {
    throw new Error(`CDP new target failed: HTTP ${res.status}`);
  }
  return readJsonWithTimeout(res, DEFAULT_CDP_HTTP_TIMEOUT_MS, requestUrl);
}

/**
 * Find a page target matching a predicate.
 * @param {(target: {type: string, url: string}) => boolean} match - Predicate to test each target.
 * @param {number} [port=9223]
 * @returns {Promise<{id: string, type: string, url: string, webSocketDebuggerUrl: string} | undefined>}
 */
export async function findPageTarget(match, port = DEFAULT_PORT) {
  const targets = await listTargets(port);
  return targets.find(
    (target) =>
      target?.type === "page" &&
      typeof target.url === "string" &&
      match(target),
  );
}

export class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandlers = new Map();
  }

  async connect(timeoutMs = DEFAULT_CDP_CONNECT_TIMEOUT_MS) {
    this.ws = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const timeoutId = timeoutMs > 0
        ? setTimeout(() => reject(makeTimeoutError("WebSocket connect timed out")), timeoutMs)
        : null;
      const resolveOnce = () => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      };
      const rejectOnce = (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      };

      this.ws.addEventListener("open", () => resolveOnce(), { once: true });
      this.ws.addEventListener("error", (event) => rejectOnce(event.error || new Error("WebSocket connect failed")), {
        once: true,
      });
    });

    this.ws.addEventListener("message", (event) => {
      const text = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
      const payload = JSON.parse(text);
      if (typeof payload.id !== "number") {
        if (typeof payload.method === "string") {
          const handlers = this.eventHandlers.get(payload.method);
          if (handlers?.size) {
            for (const handler of [...handlers]) {
              try {
                handler(payload.params ?? {});
              } catch {
              }
            }
          }
        }
        return;
      }
      const waiter = this.pending.get(payload.id);
      if (!waiter) return;
      this.pending.delete(payload.id);
      if (payload.error) {
        waiter.reject(new Error(payload.error.message || JSON.stringify(payload.error)));
      } else {
        waiter.resolve(payload.result);
      }
    });
  }

  async send(method, params = {}, timeoutMs = DEFAULT_CDP_SEND_TIMEOUT_MS) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("CDP socket is not open");
    }
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    const response = new Promise((resolve, reject) => {
      const timeoutId = timeoutMs > 0
        ? setTimeout(() => {
          this.pending.delete(id);
          reject(makeTimeoutError(`Timed out waiting for CDP response: ${method}`));
        }, timeoutMs)
        : null;

      this.pending.set(id, {
        resolve: (value) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(value);
        },
        reject: (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        },
      });
    });
    this.ws.send(message);
    return response;
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) {
      this.eventHandlers.set(method, new Set());
    }
    const handlers = this.eventHandlers.get(method);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (!handlers.size) {
        this.eventHandlers.delete(method);
      }
    };
  }

  waitForEvent(method, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      let timeoutId = null;
      const off = this.on(method, (params) => {
        try {
          if (!predicate(params)) return;
          if (timeoutId) clearTimeout(timeoutId);
          off();
          resolve(params);
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId);
          off();
          reject(error);
        }
      });

      timeoutId = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for CDP event: ${method}`));
      }, timeoutMs);
    });
  }

  async close(timeoutMs = 0) {
    if (!this.ws) return;
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      const timeoutId = timeoutMs > 0 ? setTimeout(() => resolve(), timeoutMs) : null;
      this.ws.addEventListener("close", () => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      }, { once: true });
      try {
        this.ws.close();
      } catch {
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      }
    });
  }
}

/**
 * Minimize the browser window associated with the given CDP client.
 * @param {CdpClient} client
 * @returns {Promise<{ok: boolean, minimized?: boolean, windowId?: number, skipped?: boolean, reason?: string, error?: string}>}
 */
export async function minimizeBrowserWindow(client) {
  if (!client) return { ok: false, skipped: true };

  try {
    const info = await client.send("Browser.getWindowForTarget");
    const windowId = info?.windowId;
    if (windowId == null) {
      return { ok: false, skipped: true, reason: "NO_WINDOW_ID" };
    }

    await client.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "minimized" },
    });

    return { ok: true, minimized: true, windowId };
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      error: error?.message || String(error),
    };
  }
}

/**
 * Connect to a CDP target, enable Page/Runtime domains, inject stealth patches, and minimize the window.
 * @param {{webSocketDebuggerUrl: string}} target - A target object from listTargets().
 * @returns {Promise<CdpClient>} A connected CdpClient with stealth injected.
 * @throws {Error} If the target has no webSocketDebuggerUrl.
 */
export async function connectToTarget(target) {
  if (!target?.webSocketDebuggerUrl) {
    throw new Error("Target has no webSocketDebuggerUrl");
  }

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  // Inject stealth patches after Page/Runtime are enabled but before
  // bringToFront, so the page is patched before any user-visible interaction.
  // Partial failure is tolerated — stealth is best-effort.
  try {
    client.stealth = await injectStealth(client);
  } catch (error) {
    // Both persistent and immediate injection failed.
    // connectToTarget still returns a usable client.
    client.stealth = {
      ok: false,
      persistent: false,
      immediate: false,
      warnings: Array.isArray(error?.warnings)
        ? error.warnings
        : [error?.message || String(error)],
    };
  }

  try {
    await client.send("Page.bringToFront");
  } catch {
  }
  await minimizeBrowserWindow(client);
  return client;
}

/**
 * Navigate a page to a URL and wait for it to settle.
 * @param {CdpClient} client
 * @param {string} url
 * @param {number} [waitMs=2500] - Time to wait after navigation.
 * @returns {Promise<void>}
 */
export async function navigate(client, url, waitMs = 2500) {
  await client.send("Page.navigate", { url });
  await sleep(waitMs);
}

/**
 * Insert text at the current focus point via CDP Input.insertText.
 * @param {CdpClient} client
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function insertText(client, text) {
  await client.send("Input.insertText", { text: String(text ?? "") });
}

/**
 * Simulate a key press (keyDown + keyUp) via CDP.
 * @param {CdpClient} client
 * @param {string} key - The key identifier (e.g. "Enter", "Tab").
 * @param {{code?: string, text?: string, modifiers?: number, windowsVirtualKeyCode?: number, nativeVirtualKeyCode?: number}} [options]
 * @returns {Promise<void>}
 */
export async function pressKey(client, key, options = {}) {
  const {
    code = key,
    text = "",
    modifiers = 0,
    windowsVirtualKeyCode = 0,
    nativeVirtualKeyCode = windowsVirtualKeyCode,
  } = options;

  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    text,
    unmodifiedText: text,
    modifiers,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    modifiers,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode,
  });
}

/**
 * Click at a specific point on the page.
 * @param {CdpClient} client
 * @param {{x: number, y: number}} point - Coordinates to click.
 * @returns {Promise<void>}
 */
export async function clickPoint(client, { x, y }) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
    buttons: 0,
    pointerType: "mouse",
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    buttons: 1,
    clickCount: 1,
    pointerType: "mouse",
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    buttons: 0,
    clickCount: 1,
    pointerType: "mouse",
  });
}

/**
 * Evaluate a JavaScript expression in the page context and return the result.
 * @param {CdpClient} client
 * @param {string} expression - JavaScript expression to evaluate.
 * @returns {Promise<unknown>} The evaluated result value.
 * @throws {Error} If the evaluation throws an exception in the page.
 */
export async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "CDP evaluate failed");
  }
  return result?.result?.value;
}

/**
 * Retrieve a network response body as parsed JSON.
 * @param {CdpClient} client
 * @param {string} requestId - The CDP Network request id.
 * @returns {Promise<unknown>} Parsed JSON body.
 */
export async function getJsonResponseBody(client, requestId) {
  const result = await client.send("Network.getResponseBody", { requestId });
  const raw = result?.base64Encoded
    ? Buffer.from(result.body || "", "base64").toString("utf8")
    : String(result?.body || "");
  return JSON.parse(raw);
}

export { DEFAULT_PORT };
