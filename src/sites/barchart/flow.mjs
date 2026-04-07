import { connectToTarget, createTarget, evaluate, findPageTarget, navigate } from "../../core/cdp.mjs";
import { getBarchartPort } from "./common.mjs";

export function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function normalizeLimit(limit, fallback = 20) {
  return Number.isFinite(limit) ? Math.max(1, limit) : fallback;
}

function normalizeType(type) {
  return String(type || "all").trim().toLowerCase();
}

function toBarchartFlowItem(row) {
  const normalized = row?.raw || row || {};
  return {
    symbol: normalized.baseSymbol || normalized.symbol || "",
    type: normalized.optionType || "",
    strike: round(normalized.strikePrice),
    expiration: normalized.expirationDate || "",
    last: round(normalized.lastPrice),
    volume: normalized.volume ?? null,
    openInterest: normalized.openInterest ?? null,
    volOiRatio: round(normalized.volumeOpenInterestRatio),
    iv: round(normalized.volatility),
  };
}

function filterBarchartFlowRows(rows, { type = "all", symbol = null } = {}) {
  const normalizedType = normalizeType(type);
  const normalizedSymbol = symbol ? String(symbol).trim().toUpperCase() : null;

  return [...(Array.isArray(rows) ? rows : [])]
    .map((item) => item?.raw || item)
    .filter((row) => {
      if (!row) return false;

      if (normalizedSymbol) {
        const rowSymbol = String(row.baseSymbol || row.symbol || "").trim().toUpperCase();
        if (rowSymbol !== normalizedSymbol) {
          return false;
        }
      }

      if (normalizedType !== "all") {
        return String(row.optionType || "").toLowerCase() === normalizedType;
      }

      return true;
    });
}

function createBarchartFlowFailure(result, { type, symbol = null, message } = {}) {
  const normalized = {
    ok: false,
    type: normalizeType(type),
    status: result?.status ?? null,
    needsLogin: result?.code === "needs-login" || result?.code === "no-csrf",
    message,
    body: result?.body || result?.message || "",
  };

  if (symbol) {
    normalized.symbol = String(symbol).trim().toUpperCase();
  }

  return normalized;
}

export function parseBarchartFlowResponses(result, { type = "all", limit = 20 } = {}) {
  const normalizedType = normalizeType(type);
  const maxItems = normalizeLimit(limit);

  if (!result?.ok) {
    return createBarchartFlowFailure(result, {
      type: normalizedType,
      message: "Barchart options flow requires a valid session in the shared agent browser.",
    });
  }

  for (const response of result.responses || []) {
    if (!response?.ok) {
      if (response?.status === 401 || response?.status === 403) {
        return createBarchartFlowFailure(
          {
            code: "needs-login",
            status: response.status,
            body: String(response.text || "").slice(0, 300),
          },
          {
            type: normalizedType,
            message: "Barchart options flow requires a valid session in the shared agent browser.",
          },
        );
      }
      continue;
    }

    let json;
    try {
      json = JSON.parse(String(response.text || ""));
    } catch {
      continue;
    }

    const rows = Array.isArray(json?.data) ? json.data : [];
    if (rows.length === 0) {
      continue;
    }

    const filteredRows = filterBarchartFlowRows(rows, { type: normalizedType });
    if (filteredRows.length === 0) {
      continue;
    }

    const items = filteredRows.slice(0, maxItems).map(toBarchartFlowItem);
    return {
      ok: true,
      type: normalizedType,
      sourceList: response.list || null,
      count: items.length,
      items,
    };
  }

  return {
    ok: true,
    type: normalizedType,
    sourceList: null,
    count: 0,
    items: [],
  };
}

export function parseBarchartFlowSymbolResponse(result, { symbol, type = "all", limit = 20 } = {}) {
  const normalizedType = normalizeType(type);
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const maxItems = normalizeLimit(limit);

  if (!result?.ok) {
    return createBarchartFlowFailure(result, {
      symbol: normalizedSymbol,
      type: normalizedType,
      message: "Barchart symbol flow requires a valid session in the shared agent browser.",
    });
  }

  if (!result.response?.ok) {
    const code = result.response?.status === 401 || result.response?.status === 403 ? "needs-login" : "http-error";
    return createBarchartFlowFailure(
      {
        code,
        status: result.response?.status ?? null,
        body: String(result.response?.text || "").slice(0, 300),
      },
      {
        symbol: normalizedSymbol,
        type: normalizedType,
        message: "Barchart symbol flow requires a valid session in the shared agent browser.",
      },
    );
  }

  let json;
  try {
    json = JSON.parse(String(result.response?.text || ""));
  } catch (error) {
    return createBarchartFlowFailure(
      {
        code: "request-failed",
        message: String(error),
      },
      {
        symbol: normalizedSymbol,
        type: normalizedType,
        message: "Barchart symbol flow requires a valid session in the shared agent browser.",
      },
    );
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  const items = filterBarchartFlowRows(rows, {
    symbol: normalizedSymbol,
    type: normalizedType,
  })
    .slice(0, maxItems)
    .map(toBarchartFlowItem);

  return {
    ok: true,
    symbol: normalizedSymbol,
    type: normalizedType,
    count: items.length,
    items,
  };
}

export async function runBarchartFlow(flags) {
  const type = normalizeType(flags.type || "all");
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);

  if (!["all", "call", "put"].includes(type)) {
    throw new Error("Invalid --type. Use all, call, or put");
  }

  const target = await findPageTarget(
    (entry) => /barchart\.com/i.test(entry.url) && /\/options\/unusual-activity\//i.test(entry.url),
    port,
  ) || await createTarget("https://www.barchart.com/options/unusual-activity/stocks", port);
  const client = await connectToTarget(target);

  try {
    await navigate(client, "https://www.barchart.com/options/unusual-activity/stocks", 4000);

    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const typeFilter = ${JSON.stringify(type)};

        let csrf = '';
        for (let i = 0; i < 10; i += 1) {
          csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
          if (csrf) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!csrf) {
          return { ok: false, code: 'no-csrf', message: 'No CSRF token found' };
        }

        const headers = { 'X-CSRF-TOKEN': csrf };
        const fields = [
          'baseSymbol','strikePrice','expirationDate','optionType',
          'lastPrice','volume','openInterest','volumeOpenInterestRatio','volatility'
        ].join(',');
        const fetchLimit = typeFilter !== 'all' ? limit * 3 : limit;
        const lists = [
          'options.unusual_activity.stocks.us',
          'options.mostActive.us'
        ];
        const responses = [];

        for (const list of lists) {
          try {
            const url = '/proxies/core-api/v1/options/get?list=' + encodeURIComponent(list)
              + '&fields=' + encodeURIComponent(fields)
              + '&orderBy=volumeOpenInterestRatio&orderDir=desc'
              + '&raw=1&limit=' + fetchLimit;

            const resp = await fetch(url, { credentials: 'include', headers });
            const text = await resp.text();
            responses.push({ list, ok: resp.ok, status: resp.status, text });
            if (resp.status === 401 || resp.status === 403) {
              break;
            }
          } catch (error) {
            responses.push({ list, ok: false, status: null, text: '', message: String(error) });
          }
        }

        return { ok: true, responses };
      })()
    `);

    const normalized = parseBarchartFlowResponses(result, { type, limit });
    if (!normalized.ok) {
      process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
      process.exitCode = normalized.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
