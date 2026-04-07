function parseXiaoyuzhouInput(input) {
  const raw = String(input || "").trim();
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const type = parts[0] || "";
    const id = parts[1] || "";
    return {
      input: raw,
      type,
      id,
      canonicalUrl: type && id ? `https://www.xiaoyuzhoufm.com/${type}/${id}` : "",
    };
  } catch {
    const normalized = raw.replace(/^\/+|\/+$/g, "");
    const parts = normalized.split("/");
    if (parts.length >= 2) {
      return {
        input: raw,
        type: parts[0],
        id: parts[1],
        canonicalUrl: `https://www.xiaoyuzhoufm.com/${parts[0]}/${parts[1]}`,
      };
    }
    return {
      input: raw,
      type: "",
      id: raw,
      canonicalUrl: "",
    };
  }
}

export async function runXiaoyuzhouUtils(flags) {
  const value = String(flags.url || flags.input || flags.id || "").trim();
  if (!value) {
    throw new Error("Missing required --url");
  }

  const parsed = parseXiaoyuzhouInput(value);
  process.stdout.write(`${JSON.stringify({
    ok: Boolean(parsed.id),
    ...parsed,
  }, null, 2)}\n`);
}
