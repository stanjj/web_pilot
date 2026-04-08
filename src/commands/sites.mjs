import { buildRegistry } from "../command-registrations.mjs";
import sites from "../sites/manifest.json" with { type: "json" };

function enrichSiteEntry(entry, registry) {
  if (entry?.site !== "tradingview") {
    return entry;
  }

  const commands = registry.listBySite("tradingview").map((cmd) => cmd.action).sort();
  return {
    ...entry,
    loginRequired: null,
    loginMode: "mixed",
    publicCommands: commands.filter((action) => action === "status" || action === "quote"),
    loginRequiredCommands: commands.filter((action) => action === "historical-flow" || action === "live-flow"),
  };
}

export async function runSitesList() {
  const registry = buildRegistry();
  const data = { count: sites.length, sites: sites.map((entry) => enrichSiteEntry(entry, registry)) };
  process.stdout.write(`${JSON.stringify({ ok: true, ...data }, null, 2)}\n`);
  return data;
}
