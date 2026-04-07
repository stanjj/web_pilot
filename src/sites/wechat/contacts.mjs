import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWechatPage, getWechatPort, getWechatUrl } from "./common.mjs";

export async function runWechatContacts(flags) {
  const port = getWechatPort(flags.port);
  const { client } = await connectWechatPage(port);
  try {
    await navigate(client, getWechatUrl(), 3500);
    const result = await evaluate(client, `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
        const target = buttons.find((el) => /通讯录|contacts/i.test(el.textContent || el.getAttribute('aria-label') || ''));
        if (target) target.click();
        return {
          ok: true,
          status: target ? 'Contacts panel opened' : 'Contacts button not found, but session is connected',
          title: document.title
        };
      })()
    `);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
