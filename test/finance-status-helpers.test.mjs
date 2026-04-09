import assert from "node:assert/strict";
import test from "node:test";

import { summarizePineifyStatusSnapshot } from "../src/sites/pineify/helpers.mjs";
import { summarizeInsiderFinanceStatusSnapshot } from "../src/sites/insiderfinance/helpers.mjs";
import { summarizeUnusualWhalesStatusSnapshot } from "../src/sites/unusual-whales/helpers.mjs";
import { summarizeWhaleStreamStatusSnapshot } from "../src/sites/whalestream/helpers.mjs";

test("summarizePineifyStatusSnapshot requires a site token", () => {
  assert.deepEqual(
    summarizePineifyStatusSnapshot({
      url: "https://pineify.app/historical-options-flow-analyzer",
      title: "Pineify",
      apiStatus: 200,
      tokenLength: 32,
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://pineify.app/historical-options-flow-analyzer",
      title: "Pineify",
      apiStatus: 200,
      hasSiteToken: true,
      tokenLength: 32,
      hasHistoricalFlowAccess: true,
      message: "",
    },
  );

  assert.equal(
    summarizePineifyStatusSnapshot({
      url: "https://pineify.app/",
      title: "Pineify",
      apiStatus: 401,
      tokenLength: 0,
      message: "Unauthorized",
    }).status,
    "Login or feature access required",
  );
});

test("summarizeInsiderFinanceStatusSnapshot requires flow access", () => {
  assert.deepEqual(
    summarizeInsiderFinanceStatusSnapshot({
      url: "https://www.insiderfinance.io/flow",
      title: "InsiderFinance",
      apiStatus: 200,
      hasFlowArray: true,
      sampleCount: 1,
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://www.insiderfinance.io/flow",
      title: "InsiderFinance",
      apiStatus: 200,
      hasFlowAccess: true,
      sampleCount: 1,
      message: "",
    },
  );
});

test("summarizeUnusualWhalesStatusSnapshot requires free flow access", () => {
  assert.deepEqual(
    summarizeUnusualWhalesStatusSnapshot({
      url: "https://unusualwhales.com/live-options-flow/free",
      title: "Unusual Whales",
      apiStatus: 200,
      hasFlowArray: true,
      sampleCount: 1,
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://unusualwhales.com/live-options-flow/free",
      title: "Unusual Whales",
      apiStatus: 200,
      hasFlowAccess: true,
      sampleCount: 1,
      message: "",
    },
  );
});

test("summarizeWhaleStreamStatusSnapshot exposes summary/news readiness", () => {
  assert.deepEqual(
    summarizeWhaleStreamStatusSnapshot({
      url: "https://www.whalestream.com/market-data/top-options-flow",
      title: "WhaleStream",
      topOptionsCount: 6,
      hasTopOptionsAccess: true,
      hasDarkPoolAccess: true,
      darkPoolStatus: 200,
      hasNewsAccess: true,
      newsStatus: 200,
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://www.whalestream.com/market-data/top-options-flow",
      title: "WhaleStream",
      topOptionsCount: 6,
      hasTopOptionsAccess: true,
      hasDarkPoolAccess: true,
      hasSummaryAccess: true,
      hasNewsAccess: true,
      newsStatus: 200,
      darkPoolStatus: 200,
      message: "",
    },
  );
});
