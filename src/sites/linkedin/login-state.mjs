import { evaluate } from "../../core/cdp.mjs";
import { connectLinkedinPage, getLinkedinPort } from "./common.mjs";
import { summarizeLinkedinPage } from "./helpers.mjs";

export async function runLinkedinLoginState(flags) {
  const port = getLinkedinPort(flags.port);
  const { client } = await connectLinkedinPage(port);

  try {
    const snapshot = await evaluate(client, `
      (() => {
        const profileLink = Array.from(document.querySelectorAll('a[href*="/in/"]'))
          .find((node) => {
            const text = (node.getAttribute('aria-label') || node.textContent || '').trim();
            return /me|profile|view profile/i.test(text);
          });

        return {
          url: location.href,
          title: document.title,
          bodyText: (document.body?.innerText || '').slice(0, 1800),
          hasGlobalNav: Boolean(document.querySelector('header nav, .global-nav, [data-test-global-nav-link], [data-control-name="nav.settings"]')),
          hasSearchBox: Boolean(document.querySelector('input[placeholder*="Search"], input[aria-label*="Search"]')),
          currentUserName: profileLink?.getAttribute('aria-label') || profileLink?.textContent || '',
          currentUserUrl: profileLink?.href || '',
        };
      })()
    `);
    const result = summarizeLinkedinPage(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
