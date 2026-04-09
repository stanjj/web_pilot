import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectPineifyPage, getPineifyHistoricalFlowUrl, getPineifyPort } from "./common.mjs";
import { summarizePineifyStatusSnapshot } from "./helpers.mjs";

export async function runPineifyStatus(flags) {
  const port = getPineifyPort(flags.port);
  const { client } = await connectPineifyPage(port);

  try {
    await navigate(client, getPineifyHistoricalFlowUrl(), 3000);
    const snapshot = await evaluate(client, `
      (async () => {
        let apiStatus = null;
        let tokenLength = 0;
        let hasSiteToken = false;
        let message = "";

        try {
          const response = await fetch("https://pineifyapi.pineify.app/api/auth/site-token", {
            credentials: "include",
            headers: {
              "content-type": "application/json",
            },
          });
          apiStatus = response.status;
          const text = await response.text();
          let payload = null;
          try {
            payload = JSON.parse(text);
          } catch {
            payload = null;
          }
          const token = typeof payload?.data?.token === "string" ? payload.data.token : "";
          tokenLength = token.length;
          hasSiteToken = tokenLength > 0;
          message = payload?.msg || payload?.message || text.slice(0, 160);
        } catch (error) {
          message = String(error);
        }

        return {
          url: location.href,
          title: document.title,
          apiStatus,
          tokenLength,
          hasSiteToken,
          message,
        };
      })()
    `);
    const result = summarizePineifyStatusSnapshot(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
