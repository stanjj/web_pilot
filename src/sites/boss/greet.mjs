import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBossPage } from "./common.mjs";

export async function runBossGreet(flags) {
  const securityId = flags["security-id"];
  const lid = flags.lid;
  const jobUrl = flags["job-url"];
  const port = Number(flags.port ?? 9223);

  if (!securityId) {
    throw new Error("Missing required --security-id");
  }
  if (!lid) {
    throw new Error("Missing required --lid");
  }

  const { client } = await connectBossPage(port);

  try {
    await navigate(client, jobUrl || "https://www.zhipin.com/web/geek/job", 2500);

    const apiUrl = new URL("https://www.zhipin.com/wapi/zpgeek/friend/add.json");
    apiUrl.searchParams.set("securityId", securityId);
    apiUrl.searchParams.set("lid", lid);

    const expression = `
      (async () => {
        const response = await fetch(${JSON.stringify(apiUrl.toString())}, {
          credentials: "include",
          headers: { "Accept": "application/json, text/plain, */*" }
        });
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (error) {
          return { code: -1, message: "JSON parse failed: " + String(error), raw: text.slice(0, 200) };
        }
      })()
    `;

    const result = await evaluate(client, expression);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result?.code && result.code !== 0) process.exitCode = 1;
  } finally {
    await client.close();
  }
}
