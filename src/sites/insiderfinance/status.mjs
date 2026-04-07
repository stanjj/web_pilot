import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectInsiderFinancePage, getInsiderFinancePort, getInsiderFinanceUrl } from "./common.mjs";

export async function runInsiderFinanceStatus(flags) {
  const port = getInsiderFinancePort(flags.port);
  const { client } = await connectInsiderFinancePage(port);

  try {
    await navigate(client, getInsiderFinanceUrl(), 2500);
    const result = await evaluate(client, `
      (() => ({
        ok: true,
        status: 'Connected',
        url: location.href,
        title: document.title
      }))()
    `);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
