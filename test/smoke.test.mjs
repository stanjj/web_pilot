import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildRegistry } from "../src/command-registrations.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..");
const CLI_PATH = path.join(REPO_ROOT, "src", "cli.mjs");
const MANIFEST_PATH = path.join(REPO_ROOT, "src", "sites", "manifest.json");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...(options.env || {}) },
  });
}

test("CLI loads", () => {
  const result = runCli(["sites", "list"]);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.sites));
});

test("json mode wraps successful command output", () => {
  const result = runCli(["--json", "sites", "list"]);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.meta.elapsedMs, "number");
  assert.equal(payload.meta.command, "sites list");
  assert.equal(payload.data.count > 0, true);
  assert.ok(Array.isArray(payload.data.sites));
  assert.equal("ok" in payload.data, false);
});

test("json mode normalizes legacy success payloads", () => {
  const result = runCli(["--json", "boss", "profile"]);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.meta.command, "boss profile");
  assert.equal(typeof payload.data.profilePath, "string");
  assert.equal(typeof payload.data.profile, "object");
  assert.equal("ok" in payload.data, false);
});

test("json mode wraps unknown command failures", () => {
  const result = runCli(["--json", "nonexistent", "xyz"]);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "USAGE_ERROR");
  assert.match(payload.error, /Unknown command: nonexistent xyz/);
  assert.match(payload.hint, /node src\/cli\.mjs --help/);
  assert.equal(payload.meta.command, "nonexistent xyz");
});

test("json mode wraps usage failures", () => {
  const result = runCli(["--json"]);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "USAGE_ERROR");
  assert.match(payload.error, /Missing command/);
  assert.match(payload.hint, /node src\/cli\.mjs --help/);
});

test("json mode returns unknown command for unregistered site", () => {
  const result = runCli(["--json", "ghost-site", "pending"]);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "USAGE_ERROR");
  assert.match(payload.error, /Unknown command: ghost-site pending/);
  assert.equal(payload.meta.command, "ghost-site pending");
});

test("sites coverage exposes registry summary and manifest metadata", () => {
  const result = runCli(["sites", "coverage"]);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.summary.totalSites, "number");
  assert.equal(typeof payload.summary.totalCommands, "number");
  assert.ok(Array.isArray(payload.core));
  assert.ok(Array.isArray(payload.sites));

  const boss = payload.sites.find((entry) => entry.site === "boss");
  assert.ok(boss);
  assert.equal(typeof boss.loginRequired, "boolean");
  assert.equal(typeof boss.notes, "string");
  assert.ok(Array.isArray(boss.commands));
  assert.ok(boss.commands.includes("inbox"));
});

test("help output works", () => {
  const globalHelp = runCli(["--help"]);
  assert.equal(globalHelp.error, undefined);
  assert.equal(globalHelp.status, 0);
  assert.match(globalHelp.stdout, /Available sites and commands:/);
  assert.match(globalHelp.stdout, /\bboss\b/);

  const siteHelp = runCli(["boss", "--help"]);
  assert.equal(siteHelp.error, undefined);
  assert.equal(siteHelp.status, 0);
  assert.match(siteHelp.stdout, /Site: boss/);
  assert.match(siteHelp.stdout, /search -/);

  const commandHelp = runCli(["boss", "search", "--help"]);
  assert.equal(commandHelp.error, undefined);
  assert.equal(commandHelp.status, 0);
  assert.match(commandHelp.stdout, /Command: boss search/);
  assert.match(commandHelp.stdout, /Usage: node src\/cli\.mjs boss search/);

  const discordSearchHelp = runCli(["discord-app", "search", "--help"]);
  assert.equal(discordSearchHelp.error, undefined);
  assert.equal(discordSearchHelp.status, 0);
  assert.match(discordSearchHelp.stdout, /Command: discord-app search/);
  assert.match(discordSearchHelp.stdout, /--server <name>/);
  assert.match(discordSearchHelp.stdout, /--user <name>/);
  assert.match(discordSearchHelp.stdout, /--channel <name>/);
});

test("unknown command fails usefully", () => {
  const result = runCli(["nonexistent", "xyz"]);

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown command: nonexistent xyz/);
  assert.match(result.stderr, /node src\/cli\.mjs --help/);

  const unknownSiteHelp = runCli(["nonexistent", "--help"]);
  assert.equal(unknownSiteHelp.error, undefined);
  assert.notEqual(unknownSiteHelp.status, 0);
  assert.match(unknownSiteHelp.stderr, /Unknown site: nonexistent/);

  const unknownCommandHelp = runCli(["boss", "xyz", "--help"]);
  assert.equal(unknownCommandHelp.error, undefined);
  assert.notEqual(unknownCommandHelp.status, 0);
  assert.match(unknownCommandHelp.stderr, /Unknown command: boss xyz/);
});

test("registry integrity", () => {
  const registry = buildRegistry();

  assert.ok(registry.resolve("sites", "list"));
  assert.ok(registry.resolve("sites", "coverage"));
  assert.ok(registry.resolve("boss", "search"));
  assert.ok(registry.resolve("barchart", "quote"));
});

test("manifest sanity", () => {
  const rawManifest = readFileSync(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(rawManifest);

  assert.ok(Array.isArray(manifest));
  assert.ok(manifest.length > 0);

  manifest.forEach((entry, index) => {
    assert.equal(typeof entry.site, "string", `manifest entry ${index} missing site`);
    assert.ok(entry.site.length > 0, `manifest entry ${index} has empty site`);
    assert.equal(typeof entry.status, "string", `manifest entry ${index} missing status`);
    assert.ok(entry.status.length > 0, `manifest entry ${index} has empty status`);
    assert.equal(typeof entry.loginRequired, "boolean", `manifest entry ${index} missing loginRequired`);
    assert.equal(typeof entry.notes, "string", `manifest entry ${index} missing notes`);
  });
});
