import assert from "node:assert/strict";
import test from "node:test";

import { CdpClient } from "../src/core/cdp.mjs";

test("CdpClient.send times out when a response never arrives", async () => {
  const originalWebSocket = globalThis.WebSocket;

  class MockWebSocket {
    static OPEN = 1;

    constructor() {
      this.readyState = MockWebSocket.OPEN;
    }

    addEventListener() {}

    send() {}

    close() {
      this.readyState = 3;
    }
  }

  globalThis.WebSocket = MockWebSocket;

  try {
    const client = new CdpClient("ws://example.test");
    client.ws = new MockWebSocket();

    await assert.rejects(
      client.send("Runtime.evaluate", {}, 10),
      /Timed out waiting for CDP response: Runtime\.evaluate/,
    );
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});

test("CdpClient.connect times out when the socket never opens", async () => {
  const originalWebSocket = globalThis.WebSocket;

  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;

    constructor() {
      this.readyState = 0;
    }

    addEventListener() {}

    close() {
      this.readyState = MockWebSocket.CLOSED;
    }
  }

  globalThis.WebSocket = MockWebSocket;

  try {
    const client = new CdpClient("ws://example.test");

    await assert.rejects(
      client.connect(10),
      /WebSocket connect timed out/,
    );
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});