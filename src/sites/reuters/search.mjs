import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectReutersPage, getReutersPort, getReutersUrl } from "./common.mjs";

export async function runReutersSearch(flags) {
  const query = String(flags.query || "").trim();
  const limit = Math.min(Number(flags.limit ?? 10), 40);
  const port = getReutersPort(flags.port);

  if (!query) {
    throw new Error("Missing required --query");
  }

  const { client } = await connectReutersPage(port);

  try {
    await navigate(client, getReutersUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 10};
        const apiQuery = JSON.stringify({
          keyword: ${JSON.stringify(query)},
          offset: 0,
          orderby: 'display_date:desc',
          size: count,
          website: 'reuters'
        });
        const apiUrl = 'https://www.reuters.com/pf/api/v3/content/fetch/articles-by-search-v2?query=' + encodeURIComponent(apiQuery);

        try {
          const resp = await fetch(apiUrl, { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) {
            return { ok: false, status: resp.status, body: text.slice(0, 300) };
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const articles = data?.result?.articles || data?.articles || [];
          return {
            ok: true,
            count: articles.length,
            items: articles.slice(0, count).map((article, index) => ({
              rank: index + 1,
              title: article?.title || article?.headlines?.basic || '',
              date: String(article?.display_date || article?.published_time || '').split('T')[0],
              section: article?.taxonomy?.section?.name || '',
              url: article?.canonical_url ? ('https://www.reuters.com' + article.canonical_url) : ''
            }))
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        query,
        status: result?.status ?? null,
        message: "Reuters search request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      query,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
