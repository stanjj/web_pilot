import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectTradingViewPage, getTradingViewPort, getTradingViewUrl } from "./common.mjs";

export function summarizeTradingViewStatusSnapshot({
  title = "",
  url = "",
  isAuthenticated = null,
  locale = "",
  theme = null,
  hasSearchControl = false,
  hasTradingViewMeta = false,
  hasInitData = false,
  bodyText = "",
} = {}) {
  const normalizedTitle = String(title ?? "").trim();
  const normalizedUrl = String(url ?? "").trim();
  const normalizedBody = String(bodyText ?? "");
  const blocked = /just a moment|access denied|attention required|verify you are human|captcha|sorry, you have been blocked/i.test(
    `${normalizedTitle}\n${normalizedBody}`,
  );
  const onTradingView = hasTradingViewMeta || /tradingview\.com/i.test(normalizedUrl) || /tradingview/i.test(normalizedTitle);
  const ready = Boolean(hasTradingViewMeta || hasInitData || hasSearchControl);
  const ok = Boolean(onTradingView && ready && !blocked);

  return {
    ok,
    status: ok ? "Connected" : blocked ? "Blocked" : onTradingView ? "Unready" : "Unexpected page",
    url: normalizedUrl,
    title: normalizedTitle,
    isAuthenticated: typeof isAuthenticated === "boolean" ? isAuthenticated : null,
    locale: String(locale ?? "").trim(),
    theme,
    hasSearch: Boolean(hasSearchControl),
    hasInitData: Boolean(hasInitData),
  };
}

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