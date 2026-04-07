import { listTargets } from "../../core/cdp.mjs";
import { getYoutubePort } from "./common.mjs";

export async function runYoutubeTabs(flags) {
  const port = getYoutubePort(flags.port);
  const targets = await listTargets(port);

  const items = targets
    .filter((target) => target?.type === "page" && /youtube\.com|youtu\.be/i.test(String(target.url || "")))
    .map((target, index) => ({
      index: index + 1,
      targetId: target.id || "",
      title: target.title || "",
      url: target.url || "",
      attached: Boolean(target.attached),
    }));

  process.stdout.write(`${JSON.stringify({
    ok: true,
    port,
    count: items.length,
    items,
  }, null, 2)}\n`);
}
