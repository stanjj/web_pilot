import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectInsiderFinancePage,
  getInsiderFinanceFlowUrl,
  getInsiderFinancePort,
} from "./common.mjs";

function inferSmartMoneyDirection(contractType, tradeSide) {
  const cp = String(contractType || "").toLowerCase();
  const side = String(tradeSide || "").toUpperCase();
  if (side === "ASK") {
    return cp === "call" ? "bullish" : cp === "put" ? "bearish" : "neutral";
  }
  if (side === "BID") {
    return cp === "call" ? "bearish" : cp === "put" ? "bullish" : "neutral";
  }
  return "neutral";
}

function formatExpiry(year, month, day) {
  if (!year || !month || !day) return "";
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export async function fetchInsiderFinanceFlow(flags) {
  const limit = Math.min(Number(flags.limit ?? 15), 50);
  const minSize = Number(flags["min-size"] ?? 1000000);
  const port = getInsiderFinancePort(flags.port);
  const { client } = await connectInsiderFinancePage(port);

  try {
    await navigate(client, getInsiderFinanceFlowUrl(), 4000);

    const result = await evaluate(client, `
      (async () => {
        const query = \`
          query getFreeOptionFlow {
            free_option_flow {
              ticker
              cp
              orderType
              premium
              size
              strike
              tradeSide
              price
              spot
              openInterest
              impliedVol
              exchangeTimestamp
              expireYear
              expireMonth
              expireDay
              tickerDetails {
                sector
                name
              }
            }
          }
        \`;

        const response = await fetch("https://api.insiderfinance.io/v1/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            operationName: "getFreeOptionFlow",
            variables: {},
            query,
          }),
        });

        const payload = await response.json();
        return {
          ok: response.ok,
          status: response.status,
          pageTitle: document.title,
          pageUrl: location.href,
          items: payload?.data?.free_option_flow || [],
        };
      })()
    `);

    const items = (result.items || [])
      .map((item, index) => {
        const sizeValue = Number(item.premium || 0);
        const flowType = String(item.orderType || "").toLowerCase();
        const contractType = String(item.cp || "").toLowerCase();
        return {
          rank: index + 1,
          ticker: item.ticker || "",
          darkPoolPrint: false,
          flowType,
          size: item.premium != null ? `$${Number(item.premium).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "",
          sizeValue,
          smartMoneyDirection: inferSmartMoneyDirection(contractType, item.tradeSide),
          contractType,
          strike: item.strike != null ? `$${Number(item.strike).toFixed(2)}` : "",
          expiry: formatExpiry(item.expireYear, item.expireMonth, item.expireDay),
          tradeSide: item.tradeSide || "",
          spot: item.spot != null ? `$${Number(item.spot).toFixed(2)}` : "",
          price: item.price != null ? `$${Number(item.price).toFixed(2)}` : "",
          openInterest: item.openInterest ?? null,
          impliedVol: item.impliedVol != null ? Number((Number(item.impliedVol) * 100).toFixed(2)) : null,
          timestamp: item.exchangeTimestamp || null,
          sector: item.tickerDetails?.sector || "",
          company: item.tickerDetails?.name || "",
        };
      })
      .filter((item) => item.ticker)
      .filter((item) => item.sizeValue >= minSize)
      .slice(0, limit)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    return {
      ok: !!result.ok,
      minSize,
      pageTitle: result.pageTitle,
      pageUrl: result.pageUrl,
      count: items.length,
      items,
    };
  } finally {
    await client.close();
  }
}

export async function runInsiderFinanceFlow(flags) {
  const result = await fetchInsiderFinanceFlow(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
