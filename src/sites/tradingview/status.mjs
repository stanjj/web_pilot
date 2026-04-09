import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectTradingViewPage, getTradingViewPort, getTradingViewUrl } from "./common.mjs";
import { summarizeTradingViewStatusSnapshot } from "./status-helpers.mjs";

export { summarizeTradingViewStatusSnapshot } from "./status-helpers.mjs";

export async function runTradingViewStatus(flags) {
	const port = getTradingViewPort(flags.port);
	const { client } = await connectTradingViewPage(port);

	try {
		await navigate(client, getTradingViewUrl(), 3500);
		const snapshot = await evaluate(client, `
			(() => ({
				url: location.href,
				title: document.title,
				isAuthenticated: typeof is_authenticated === 'boolean' ? is_authenticated : null,
				locale: window.language || window.locale || '',
				theme: document.documentElement.classList.contains('theme-dark')
					? 'dark'
					: document.documentElement.classList.contains('theme-light')
						? 'light'
						: null,
				hasSearchControl: Boolean(document.querySelector('a[href*="/search/"], [aria-label*="Search" i], button[aria-label*="Search" i], [role="search"]')),
				hasTradingViewMeta: Boolean(document.querySelector('meta[property="og:site_name"][content="TradingView"]')),
				hasInitData: Boolean(window.initData && typeof window.initData === 'object'),
				bodyText: (document.body?.innerText || '').slice(0, 1200),
			}))()
		`);
		const result = summarizeTradingViewStatusSnapshot(snapshot);
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		return result;
	} finally {
		await client.close();
	}
}