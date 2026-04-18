import { evaluate } from "../../core/cdp.mjs";
import { connectTwitterPage, getTwitterPort } from "./common.mjs";
import { summarizeTwitterPage } from "./helpers.mjs";

export async function runTwitterLoginState(flags) {
  const port = getTwitterPort(flags.port);
  const { client } = await connectTwitterPage(port);

  try {
    const snapshot = await evaluate(client, `
      (() => {
        const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"], a[data-testid="SideNav_AccountSwitcher_Button"]')
          || Array.from(document.querySelectorAll('a[href^="/"]')).find((node) => /profile|account/i.test((node.getAttribute('aria-label') || '').trim()));
        const profileHref = profileLink?.getAttribute('href') || '';
        const currentHandle = profileHref.replace(/^\\//, '').split('/')[0];

        return {
          url: location.href,
          title: document.title,
          bodyText: (document.body?.innerText || '').slice(0, 1800),
          hasPrimaryColumn: Boolean(document.querySelector('[data-testid="primaryColumn"], main[role="main"]')),
          hasSearchInput: Boolean(document.querySelector('input[data-testid="SearchBox_Search_Input"], input[placeholder*="Search"]')),
          hasTweetComposer: Boolean(document.querySelector('[data-testid="tweetTextarea_0"], [data-testid="SideNav_NewTweet_Button"]')),
          currentUserName: profileLink?.getAttribute('aria-label') || profileLink?.textContent || '',
          currentUserHandle: currentHandle,
          currentUserUrl: profileHref ? new URL(profileHref, location.origin).href : '',
        };
      })()
    `);
    const result = summarizeTwitterPage(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
