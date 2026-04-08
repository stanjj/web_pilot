import {
  connectToTarget,
  createTarget,
  DEFAULT_PORT,
  enforcePageTargetLimit,
  listTargets,
  minimizeBrowserWindow,
} from "../core/cdp.mjs";
import { CdpConnectionError } from "../core/errors.mjs";
import { ensureAttachablePageTarget, isAttachablePageTarget, probeCdp } from "./browser-ensure.mjs";

const DEFAULT_BOOTSTRAP_URL = "about:blank";
const SMOKE_TEST_INCOMING_TABS = 1;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPageTargetCount(targets) {
  return (Array.isArray(targets) ? targets : []).filter((target) => target?.type === "page").length;
}

export async function runBrowserSmoke(flags, deps = {}) {
  const {
    probeCdpFn = probeCdp,
    listTargetsFn = listTargets,
    ensureAttachablePageTargetFn = ensureAttachablePageTarget,
    createTargetFn = createTarget,
    connectToTargetFn = connectToTarget,
    minimizeBrowserWindowFn = minimizeBrowserWindow,
    enforcePageTargetLimitFn = enforcePageTargetLimit,
    writeOutput = (text) => process.stdout.write(text),
  } = deps;

  const port = toNumber(flags.port, DEFAULT_PORT);
  const bootstrapUrl = String(flags.url || DEFAULT_BOOTSTRAP_URL);
  const probe = await probeCdpFn(port);

  if (!probe) {
    throw new CdpConnectionError(`CDP endpoint is not reachable on port ${port}`);
  }

  let targets = await listTargetsFn(port);
  let attachableTarget = targets.find(isAttachablePageTarget) || null;
  let bootstrappedPage = false;

  if (!attachableTarget) {
    const ensured = await ensureAttachablePageTargetFn({
      port,
      bootstrapUrl,
      listTargetsFn,
      createTargetFn,
    });

    if (!ensured?.ok) {
      throw new CdpConnectionError(`CDP endpoint is reachable on port ${port}, but no attachable page targets are available`);
    }

    bootstrappedPage = Boolean(ensured.created);
    targets = await listTargetsFn(port);
    attachableTarget = targets.find(isAttachablePageTarget) || ensured.target || null;
  }

  if (!attachableTarget) {
    throw new CdpConnectionError(`CDP endpoint is reachable on port ${port}, but attachable page lookup still failed`);
  }

  const client = await connectToTargetFn(attachableTarget);
  let minimized = { ok: false, skipped: true };

  try {
    minimized = await minimizeBrowserWindowFn(client);
  } finally {
    await client.close?.(1000).catch(() => {});
  }

  const tabPolicy = await enforcePageTargetLimitFn(port, SMOKE_TEST_INCOMING_TABS);
  const refreshedTargets = await listTargetsFn(port);
  const attachablePageCount = refreshedTargets.filter(isAttachablePageTarget).length || (attachableTarget ? 1 : 0);
  const pageTargetCount = getPageTargetCount(refreshedTargets) || (attachableTarget ? 1 : 0);
  const targetCount = refreshedTargets.length || (attachableTarget ? 1 : 0);
  const result = {
    ok: Boolean(minimized?.ok) && Boolean(tabPolicy?.ok),
    port,
    browser: probe.Browser || "",
    summary: {
      targetCount,
      pageTargetCount,
      attachablePageCount,
      bootstrappedPage,
    },
    checks: {
      cdpConnectivity: {
        ok: true,
        webSocketDebuggerUrl: probe.webSocketDebuggerUrl || "",
      },
      sharedBrowserAttach: {
        ok: true,
        targetId: attachableTarget.id || null,
        url: attachableTarget.url || "",
        bootstrappedPage,
      },
      windowMinimization: minimized,
      tabCountEnforcement: tabPolicy,
    },
  };

  writeOutput(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}