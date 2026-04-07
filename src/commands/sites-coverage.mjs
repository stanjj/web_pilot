import { buildRegistry } from "../command-registrations.mjs";
import manifest from "../sites/manifest.json" with { type: "json" };

export async function runSitesCoverage() {
  const registry = buildRegistry();
  const allCommands = registry.listAll();

  const manifestMap = new Map(manifest.map((entry) => [entry.site, entry]));
  const registrySites = [...new Set(allCommands.map((cmd) => cmd.site))].sort();

  const bySite = registrySites
    .filter((site) => site !== "doctor" && site !== "browser" && site !== "sites" && site !== "market")
    .map((site) => {
      const commands = registry.listBySite(site);
      const meta = manifestMap.get(site) || {};
      return {
        site,
        status: meta.status ?? "unknown",
        loginRequired: meta.loginRequired ?? null,
        notes: meta.notes ?? "",
        commandCount: commands.length,
        commands: commands.map((cmd) => cmd.action).sort(),
      };
    });

  const coreSites = registrySites
    .filter((site) => site === "doctor" || site === "browser" || site === "sites" || site === "market")
    .map((site) => {
      const commands = registry.listBySite(site);
      return {
        site,
        commandCount: commands.length,
        commands: commands.map((cmd) => cmd.action).sort(),
      };
    });

  const summary = {
    totalSites: bySite.length,
    totalCommands: allCommands.length,
    coreCommands: coreSites.reduce((sum, s) => sum + s.commandCount, 0),
    siteCommands: bySite.reduce((sum, s) => sum + s.commandCount, 0),
  };

  const data = { summary, core: coreSites, sites: bySite };
  process.stdout.write(`${JSON.stringify({ ok: true, ...data }, null, 2)}\n`);
  return data;
}
