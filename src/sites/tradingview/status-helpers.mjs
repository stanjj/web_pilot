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