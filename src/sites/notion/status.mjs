import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort, getNotionUrl } from "./common.mjs";

export async function runNotionStatus(flags) {
  const port = getNotionPort(flags.port);
  const { client } = await connectNotionPage(port);

  try {
    await navigate(client, getNotionUrl(), 2500);
    const result = await evaluate(client, `
      (() => ({
        ok: true,
        status: 'Connected',
        url: location.href,
        title: document.title,
        loggedInHint: !/log in|sign up/i.test(document.body.innerText || '')
      }))()
    `);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
