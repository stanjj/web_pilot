import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_BROWSER_PORT, AGENT_BROWSER_PROFILE, AGENT_PROFILES_DIR } from "../core/agent-browser.mjs";
import { classifyChromeDebuggerOwner } from "../core/browser-process.mjs";
import { DEFAULT_PORT } from "../core/cdp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const LAUNCH_SCRIPT = path.join(PROJECT_ROOT, "scripts", "launch_dedicated_chrome.ps1");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEFAULT_CDP_PROBE_TIMEOUT_MS = 2000;
const POWERSHELL_EXE = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
  : "powershell.exe";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonWithTimeout(response, timeoutMs) {
  let timeoutId = null;

  try {
    return await Promise.race([
      response.json(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timed out reading CDP probe response after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function probeCdp(port, timeoutMs = DEFAULT_CDP_PROBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await readJsonWithTimeout(res, timeoutMs);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseUrls(flags) {
  if (!flags.urls) return [];
  return String(flags.urls)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function execFileJson(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      try {
        resolve(JSON.parse(stdout || "{}"));
      } catch {
        resolve({ ok: true, raw: stdout });
      }
    });
  });
}

async function listChromeProcesses() {
  if (process.platform !== "win32") {
    return [];
  }

  const result = await execFileJson(
    POWERSHELL_EXE,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | Select-Object ProcessId, Name, CommandLine | ConvertTo-Json -Compress",
    ],
    { windowsHide: true, timeout: 15000 },
  );

  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && !("raw" in result)) return [result];
  return [];
}

async function verifyExistingBrowserIdentity({ port, profileDir }) {
  if (process.platform !== "win32") {
    return { ok: true, verified: false, skipped: true };
  }

  const processes = await listChromeProcesses();
  return classifyChromeDebuggerOwner(processes, { port, profileDir });
}

async function launchDedicatedChrome({ port, profileDir, chromePath, urls, show }) {
  fs.mkdirSync(profileDir, { recursive: true });
  return execFileJson(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      LAUNCH_SCRIPT,
      "-Port",
      String(port),
      "-ProfileDir",
      profileDir,
      "-ChromePath",
      chromePath,
      ...(show ? ["-Show"] : []),
      ...(urls.length ? ["-Urls", urls.join(",")] : []),
    ],
    { windowsHide: true, timeout: 15000 },
  );
}

function writeJson(writeOutput, payload) {
  writeOutput(`${JSON.stringify(payload, null, 2)}\n`);
}

export async function runBrowserEnsure(flags, deps = {}) {
  const {
    probeCdpFn = probeCdp,
    verifyExistingBrowserIdentityFn = verifyExistingBrowserIdentity,
    launchDedicatedChromeFn = launchDedicatedChrome,
    sleepFn = sleep,
    writeOutput = (text) => process.stdout.write(text),
  } = deps;

  const port = toNumber(flags.port, AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  const profileName = String(flags.profile || AGENT_BROWSER_PROFILE);
  const profileDir = path.join(AGENT_PROFILES_DIR, profileName);
  const chromePath = String(flags["chrome-path"] || DEFAULT_CHROME);
  const urls = parseUrls(flags);
  const show = Boolean(flags.show);

  const existing = await probeCdpFn(port);
  if (existing) {
    const ownership = await verifyExistingBrowserIdentityFn({ port, profileDir });
    if (!ownership.ok) {
      if (ownership.code === "PROFILE_MISMATCH") {
        throw new Error(`CDP port ${port} is already attached to a different Chrome profile`);
      }

      throw new Error(`CDP port ${port} is reachable, but the owning Chrome process could not be verified`);
    }

    writeJson(writeOutput, {
      ok: true,
      reused: true,
      verifiedProfile: ownership.verified !== false,
      processId: ownership.processId || null,
      port,
      profile: profileName,
      profileDir,
      browser: existing.Browser || "",
      webSocketDebuggerUrl: existing.webSocketDebuggerUrl || "",
    });
    return;
  }

  const ownership = await verifyExistingBrowserIdentityFn({ port, profileDir });
  if (ownership.code === "PROFILE_MISMATCH") {
    throw new Error(`CDP port ${port} is already attached to a different Chrome profile`);
  }
  if (ownership.ok && ownership.verified !== false) {
    throw new Error(`CDP port ${port} is already claimed by the expected Chrome profile, but the CDP endpoint did not respond in time`);
  }

  const launched = await launchDedicatedChromeFn({
    port,
    profileDir,
    chromePath,
    urls,
    show,
  });

  let connected = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleepFn(500);
    connected = await probeCdpFn(port);
    if (connected) break;
  }

  writeJson(writeOutput, {
    ok: Boolean(connected),
    reused: false,
    launched,
    port,
    profile: profileName,
    profileDir,
    browser: connected?.Browser || "",
    webSocketDebuggerUrl: connected?.webSocketDebuggerUrl || "",
    needsLogin: urls.some((url) => /zhipin\.com|barchart\.com|finance\.yahoo\.com/i.test(url)),
  });
}
