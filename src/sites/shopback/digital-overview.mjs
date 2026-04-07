import { fetchShopbackCategory } from "./category.mjs";
import { filterServices, sortByCashback } from "./service-utils.mjs";

const TAX_TERMS = ["tax", "h&r", "block"];
const VPN_TERMS = [
  "vpn",
  "cyberghost",
  "expressvpn",
  "nordvpn",
  "surfshark",
  "private internet access",
  "purevpn",
  "personalvpn",
  "mcafee",
  "malwarebytes",
  "avg",
];

export async function runShopbackDigitalOverview(flags) {
  const limit = Math.min(Number(flags.limit ?? 5), 20);
  const category = await fetchShopbackCategory({
    ...flags,
    slug: "digital-services",
    limit: "30",
  });

  const merchants = category?.item?.merchants || [];
  const tax = sortByCashback(filterServices(merchants, TAX_TERMS)).slice(0, limit);
  const vpn = sortByCashback(filterServices(merchants, VPN_TERMS)).slice(0, limit);
  const telecom = sortByCashback(
    merchants.filter((item) => {
      const text = `${item.name} ${item.cashback}`.toLowerCase();
      if (text.includes("private internet access")) return false;
      return text.includes("verizon") || text.includes("at&t") || text.includes("wireless") || text.includes("esim");
    }),
  ).slice(0, limit);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: "digital-services",
    sections: {
      tax,
      vpn,
      telecom,
    },
  }, null, 2)}\n`);
}
