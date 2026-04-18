import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectGrokPage, getGrokPort, getGrokUrl } from "./common.mjs";

export async function runGrokRead(flags) {
  const port = getGrokPort(flags.port);
  const { client } = await connectGrokPage(port);

  try {
    await navigate(client, getGrokUrl(), 3000);

    const result = await evaluate(client, `
      (() => {
        // Extract conversation turns from Grok's chat interface
        const turns = [];
        const messageEls = document.querySelectorAll(
          '[class*="message"], [data-testid*="message"], [role="article"], article'
        );

        for (const el of messageEls) {
          const text = (el.innerText || '').trim();
          if (!text) continue;

          // Detect role from common patterns
          const isUser = el.querySelector('[data-testid*="user"], .user-message') !== null
            || el.classList.toString().includes('user')
            || el.getAttribute('data-role') === 'user';
          const isAssistant = el.querySelector('[data-testid*="assistant"], [data-testid*="grok"]') !== null
            || el.classList.toString().includes('assistant')
            || el.classList.toString().includes('grok')
            || el.getAttribute('data-role') === 'assistant';

          turns.push({
            role: isUser ? 'user' : isAssistant ? 'assistant' : 'unknown',
            text: text.slice(0, 2000),
          });
        }

        // Fallback: grab full page text if no structured messages found
        if (turns.length === 0) {
          const body = (document.body.innerText || '').trim();
          if (body) {
            turns.push({ role: 'page', text: body.slice(0, 5000) });
          }
        }

        return {
          ok: true,
          url: location.href,
          title: document.title,
          turnCount: turns.length,
          turns,
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
