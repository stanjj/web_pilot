import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectInsiderFinancePage, getInsiderFinanceFlowUrl, getInsiderFinancePort } from "./common.mjs";
import { summarizeInsiderFinanceStatusSnapshot } from "./helpers.mjs";

export async function runInsiderFinanceStatus(flags) {
  const port = getInsiderFinancePort(flags.port);
  const { client } = await connectInsiderFinancePage(port);

  try {
    await navigate(client, getInsiderFinanceFlowUrl(), 3500);
    const snapshot = await evaluate(client, `
      (async () => {
        const query = \`
          query getFreeOptionFlowStatus {
            free_option_flow {
              ticker
            }
          }
        \`;

        let apiStatus = null;
        let hasFlowArray = false;
        let sampleCount = 0;
        let message = "";

        try {
          const response = await fetch("https://api.insiderfinance.io/v1/graphql", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              operationName: "getFreeOptionFlowStatus",
              variables: {},
              query,
            }),
          });
          apiStatus = response.status;
          const text = await response.text();
          let payload = null;
          try {
            payload = JSON.parse(text);
          } catch {
            payload = null;
          }
          const rows = Array.isArray(payload?.data?.free_option_flow) ? payload.data.free_option_flow : null;
          hasFlowArray = Array.isArray(rows);
          sampleCount = hasFlowArray ? rows.length : 0;
          message = payload?.errors?.[0]?.message || payload?.message || payload?.error || text.slice(0, 160);
        } catch (error) {
          message = String(error);
        }

        return {
          url: location.href,
          title: document.title,
          apiStatus,
          hasFlowArray,
          sampleCount,
          message,
        };
      })()
    `);
    const result = summarizeInsiderFinanceStatusSnapshot(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
