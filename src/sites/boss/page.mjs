import { connectToTarget, createTarget, DEFAULT_PORT, evaluate, findPageTarget } from "../../core/cdp.mjs";
import { ValidationError } from "../../core/errors.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";
import { getBossAccessIssue } from "./access-helpers.mjs";

export async function readBossPageState(client) {
  return evaluate(client, `
    (() => ({
      title: document.title || '',
      url: location.href || '',
      bodyText: (document.body?.innerText || '').slice(0, 4000)
    }))()
  `);
}

export async function ensureBossPageReady(client, expectedArea = "chat") {
  const pageState = await readBossPageState(client);
  const issue = getBossAccessIssue(pageState, expectedArea);

  if (!issue) {
    return pageState;
  }

  throw new ValidationError(issue.message, {
    hint: issue.hint,
    details: {
      code: issue.code,
      url: pageState?.url || "",
      title: pageState?.title || "",
    },
  });
}

export async function getBossTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /zhipin\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget("https://www.zhipin.com/", port);
}

export async function connectBossPage(port = DEFAULT_PORT) {
  const target = await getBossTarget(port);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(port);
  return { client, target };
}