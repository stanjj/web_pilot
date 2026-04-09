function normalizeBossAccessText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function getBossAccessIssue(pageState, expectedArea = "chat") {
  const url = normalizeBossAccessText(pageState?.url);
  const title = normalizeBossAccessText(pageState?.title);
  const bodyText = normalizeBossAccessText(pageState?.bodyText || pageState?.bodyPreview || pageState?.textPreview);

  if (
    /\/web\/user\/?$/i.test(url) ||
    /注册登录|登录|注册/i.test(title) ||
    /登录|注册|扫码|验证/i.test(bodyText)
  ) {
    return {
      code: "BOSS_LOGIN_REQUIRED",
      message: `BOSS ${expectedArea} requires an authenticated browser session`,
      hint: "Open the shared browser on zhipin.com, complete login or any verification challenge, then retry.",
    };
  }

  if (expectedArea === "chat" && !/\/web\/geek\/chat/i.test(url)) {
    return {
      code: "BOSS_CHAT_UNAVAILABLE",
      message: "BOSS chat did not load in the shared browser session",
      hint: "Open the shared browser and confirm the BOSS chat inbox is reachable for your account, then retry.",
    };
  }

  if (expectedArea === "job" && !/\/web\/geek\/job/i.test(url)) {
    return {
      code: "BOSS_SEARCH_UNAVAILABLE",
      message: "BOSS job search did not load in the shared browser session",
      hint: "Open the shared browser and confirm the BOSS job search page is reachable, then retry.",
    };
  }

  return null;
}