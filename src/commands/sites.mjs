import sites from "../sites/manifest.json" with { type: "json" };

export async function runSitesList() {
  const data = { count: sites.length, sites };
  process.stdout.write(`${JSON.stringify({ ok: true, ...data }, null, 2)}\n`);
  return data;
}
