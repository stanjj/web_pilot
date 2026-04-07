import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectFeishuPage, getFeishuPort, getFeishuUrl } from "./common.mjs";

export async function runFeishuRead(flags) {
  const port = getFeishuPort(flags.port);
  const { client } = await connectFeishuPage(port);
  try {
    await navigate(client, getFeishuUrl(), 2500);
    const item = await evaluate(client, `
      (() => {
        const title = document.title;
        const content = Array.from(document.querySelectorAll('[contenteditable="false"], .ql-editor, [data-testid], main'))
          .map((node) => (node.innerText || node.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 8)
          .join('\\n\\n');
        return { title, content: content || document.body.innerText.slice(0, 4000) };
      })()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, item }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
