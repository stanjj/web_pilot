import { evaluate, getJsonResponseBody, navigate } from "../../core/cdp.mjs";
import { connectUnusualWhalesPage, getUnusualWhalesFlowUrl, getUnusualWhalesPort } from "./common.mjs";
import { summarizeUnusualWhalesStatusSnapshot } from "./helpers.mjs";

export async function runUnusualWhalesStatus(flags) {
  const port = getUnusualWhalesPort(flags.port);
  const { client } = await connectUnusualWhalesPage(port);

  try {
    await client.send("Network.enable");
    const responsePromise = client.waitForEvent(
      "Network.responseReceived",
      (params) => String(params?.response?.url || "").includes("/api/option_trades/free?"),
      15000,
    );

    await navigate(client, getUnusualWhalesFlowUrl(), 4000);
    const responseEvent = await responsePromise.catch(() => null);
    let hasFlowArray = false;
    let sampleCount = 0;
    let message = responseEvent ? "" : "Timed out waiting for Unusual Whales free flow response.";

    if (responseEvent?.response?.status === 200) {
      try {
        const payload = await getJsonResponseBody(client, responseEvent.requestId);
        const rows = Array.isArray(payload?.data) ? payload.data : null;
        hasFlowArray = Array.isArray(rows);
        sampleCount = hasFlowArray ? rows.length : 0;
        if (!hasFlowArray) {
          message = JSON.stringify(payload).slice(0, 160);
        }
      } catch (error) {
        message = String(error);
      }
    } else if (responseEvent) {
      message = `HTTP ${responseEvent.response?.status ?? "unknown"} from ${responseEvent.response?.url || "unknown URL"}`;
    }

    const pageSnapshot = await evaluate(client, `
      (() => ({
        url: location.href,
        title: document.title
      }))()
    `);
    const snapshot = {
      ...pageSnapshot,
      apiStatus: responseEvent?.response?.status ?? null,
      hasFlowArray,
      sampleCount,
      message,
    };
    const result = summarizeUnusualWhalesStatusSnapshot(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
