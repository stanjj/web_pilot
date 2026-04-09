import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureNotionWorkspaceReady,
  isNotionWorkspaceUrl,
  pickPreferredNotionTarget,
  summarizeNotionPage,
} from "../src/sites/notion/helpers.mjs";

test("isNotionWorkspaceUrl distinguishes workspace pages from the marketing root", () => {
  assert.equal(isNotionWorkspaceUrl("https://www.notion.so/"), false);
  assert.equal(isNotionWorkspaceUrl("https://www.notion.com/"), false);
  assert.equal(isNotionWorkspaceUrl("https://www.notion.so/onboarding"), false);
  assert.equal(isNotionWorkspaceUrl("https://www.notion.so/My-Workspace-1234567890abcdef1234567890abcdef"), true);
});

test("summarizeNotionPage marks workspace UI as connected", () => {
  assert.deepEqual(
    summarizeNotionPage({
      url: "https://www.notion.so/My-Workspace-1234567890abcdef1234567890abcdef",
      title: "Docs",
      bodyText: "Search Settings Templates",
      hasSidebar: true,
      hasWorkspaceFrame: true,
      hasQuickFind: true,
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://www.notion.so/My-Workspace-1234567890abcdef1234567890abcdef",
      title: "Docs",
      loggedInHint: true,
      onWorkspacePage: true,
      hasSidebar: true,
      hasWorkspaceFrame: true,
      hasQuickFind: true,
    },
  );
});

test("summarizeNotionPage flags the marketing root as not ready", () => {
  const result = summarizeNotionPage({
    url: "https://www.notion.com/",
    title: "The AI workspace that works for you. | Notion",
    bodyText: "The AI workspace that works for you. Get Notion free Log in Sign up",
    hasSidebar: false,
    hasWorkspaceFrame: false,
    hasQuickFind: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "Login or workspace required");
  assert.equal(result.loggedInHint, false);
});

test("summarizeNotionPage flags onboarding pages as not ready", () => {
  const result = summarizeNotionPage({
    url: "https://www.notion.so/onboarding",
    title: "How do you want to use Notion? | Notion",
    bodyText: "How do you want to use Notion? Tell us about your team",
    hasSidebar: false,
    hasWorkspaceFrame: true,
    hasQuickFind: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "Login or workspace required");
});

test("pickPreferredNotionTarget prefers workspace tabs over the marketing root", () => {
  assert.deepEqual(
    pickPreferredNotionTarget([
      {
        type: "page",
        title: "The AI workspace that works for you. | Notion",
        url: "https://www.notion.com/",
      },
      {
        type: "page",
        title: "Docs",
        url: "https://www.notion.so/My-Workspace-1234567890abcdef1234567890abcdef",
      },
    ]),
    {
      type: "page",
      title: "Docs",
      url: "https://www.notion.so/My-Workspace-1234567890abcdef1234567890abcdef",
    },
  );
});

test("ensureNotionWorkspaceReady throws a clear workspace-required error", () => {
  assert.throws(
    () => ensureNotionWorkspaceReady({
      url: "https://www.notion.com/",
      title: "The AI workspace that works for you. | Notion",
      bodyText: "Get Notion free Log in Sign up",
    }),
    /Open a logged-in Notion workspace page in the shared browser before using this command\./,
  );
});
