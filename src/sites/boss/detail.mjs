import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBossPage } from "./common.mjs";

function buildDetailUrl(flags) {
  const direct = String(flags.url || "").trim();
  if (direct) return direct;
  const jobId = String(flags.jobId || flags["job-id"] || flags.securityId || "").trim();
  if (jobId) return `https://www.zhipin.com/job_detail/${jobId}.html`;
  return "https://www.zhipin.com/web/geek/chat";
}

export async function runBossDetail(flags) {
  const port = Number(flags.port ?? 9223);
  const { client } = await connectBossPage(port);

  try {
    await navigate(client, buildDetailUrl(flags), 3500);
    const item = await evaluate(client, `
      (() => {
        const root = document.querySelector('.job-detail-box, .job-card, .job-banner, .job-detail');
        const text = (root?.innerText || document.body.innerText || '').trim();
        const title =
          document.querySelector('.job-name, .name, .job-title')?.textContent?.trim()
          || document.title;
        const salary =
          document.querySelector('.salary, .job-salary')?.textContent?.trim()
          || '';
        const company =
          document.querySelector('.company-name, .company-name-text, .company-info .name')?.textContent?.trim()
          || '';
        const jobLocation =
          document.querySelector('.job-location, .location-address, .location')?.textContent?.trim()
          || '';
        const description =
          document.querySelector('.job-sec-text, .job-detail-section, .job-description')?.innerText?.trim()
          || text.slice(0, 5000);

        return {
          url: window.location.href,
          title,
          company,
          salary,
          location: jobLocation,
          description
        };
      })()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, item }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
