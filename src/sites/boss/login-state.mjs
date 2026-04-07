import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBossPage, getBossAccessIssue, readBossPageState } from "./common.mjs";

const BOSS_PAGES = {
  home: "https://www.zhipin.com/",
  chat: "https://www.zhipin.com/web/geek/chat",
  search: "https://www.zhipin.com/web/geek/job",
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function probeLoginState(client, area, url) {
  await navigate(client, url, 3000);
  const pageState = await readBossPageState(client);
  const issue = getBossAccessIssue(pageState, area);

  if (!issue) {
    return {
      area,
      loggedIn: true,
      url: pageState?.url || url,
      title: pageState?.title || "",
    };
  }

  return {
    area,
    loggedIn: false,
    code: issue.code,
    hint: issue.hint,
    url: pageState?.url || url,
    title: pageState?.title || "",
  };
}

export async function runBossLoginState(flags) {
  const port = toNumber(flags.port, 9223);
  const areaArg = flags.area ? String(flags.area).trim().toLowerCase() : "all";

  const areasToCheck =
    areaArg === "all"
      ? Object.keys(BOSS_PAGES)
      : areaArg.split(",").map((a) => a.trim()).filter((a) => a in BOSS_PAGES);

  if (!areasToCheck.length) {
    throw new Error(`Unknown area(s): ${areaArg}. Available: home, chat, search, all`);
  }

  const { client } = await connectBossPage(port);

  try {
    const results = [];
    for (const area of areasToCheck) {
      const result = await probeLoginState(client, area, BOSS_PAGES[area]);
      results.push(result);
    }

    const allLoggedIn = results.every((r) => r.loggedIn);

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        loggedIn: allLoggedIn,
        pages: results,
      }, null, 2)}\n`,
    );
  } finally {
    await client.close();
  }
}
