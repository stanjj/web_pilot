import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectDiscordPage, getDiscordPort, getDiscordUrl } from "./common.mjs";

export async function runDiscordStatus(flags) {
  const port = getDiscordPort(flags.port);
  const { client } = await connectDiscordPage(port);

  try {
    await navigate(client, getDiscordUrl(), 2500);
    const result = await evaluate(client, `
      (() => ({
        ok: true,
        status: 'Connected',
        url: location.href,
        title: document.title,
        loggedInHint: !/login|register/i.test(document.body.innerText || '')
      }))()
    `);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
