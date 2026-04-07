import { navigate } from "../../core/cdp.mjs";
import { connectBossPage, selectBossThread } from "./common.mjs";
import { formatBossThreadSelectionError } from "./thread-selector.mjs";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Open a BOSS thread by index or name without reading its full message history.
 * Returns the selection metadata so the caller knows which thread was opened.
 */
export async function runBossOpenThread(flags) {
  const port = toNumber(flags.port, 9223);
  const index = flags.index !== undefined ? toNumber(flags.index, NaN) : null;
  const name = flags.name ? String(flags.name) : "";

  if (!Number.isInteger(index) && !name) {
    throw new Error("Missing thread selector: use --index <n> or --name <text>");
  }

  const { client } = await connectBossPage(port);

  try {
    await navigate(client, "https://www.zhipin.com/web/geek/chat", 3000);
    const selection = await selectBossThread(client, { index, name });
    if (!selection?.ok) {
      throw new Error(formatBossThreadSelectionError(selection));
    }

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        opened: true,
        selectedIndex: selection.index,
        preview: selection.preview,
        expected: selection.expected,
        matchType: selection.matchType,
      }, null, 2)}\n`,
    );
  } finally {
    await client.close();
  }
}
