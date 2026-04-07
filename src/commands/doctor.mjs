import { DEFAULT_PORT, listTargets } from "../core/cdp.mjs";
import { autoMinimizeChromeForPort } from "../core/windows.mjs";

export async function runDoctor(flags) {
  const port = Number(flags.port ?? DEFAULT_PORT);
  const targets = await listTargets(port);
  const pages = targets
    .filter((target) => target?.type === "page")
    .map((target) => ({
      id: target.id ?? "",
      title: target.title ?? "",
      url: target.url ?? "",
      attached: Boolean(target.webSocketDebuggerUrl),
    }));
  const minimized = await autoMinimizeChromeForPort(port);

  process.stdout.write(
    `${JSON.stringify({ ok: true, port, pageCount: pages.length, pages, minimized }, null, 2)}\n`,
  );
}
