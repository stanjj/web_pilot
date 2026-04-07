import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectZhihuPage, getZhihuPort, getZhihuUrl } from "./common.mjs";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export async function runZhihuQuestion(flags) {
  const id = String(flags.id ?? "").trim();
  if (!id) {
    throw new Error("Missing required flag: --id");
  }

  const limit = Math.min(Number(flags.limit ?? 5), 10);
  const port = getZhihuPort(flags.port);
  const { client } = await connectZhihuPage(port);

  try {
    await navigate(client, getZhihuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const id = ${JSON.stringify(id)};
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 5};
        const questionUrl = 'https://www.zhihu.com/api/v4/questions/' + encodeURIComponent(id);
        const answersUrl = 'https://www.zhihu.com/api/v4/questions/' + encodeURIComponent(id) + '/answers?limit=' + limit + '&offset=0&sort_by=default';

        try {
          const [questionResp, answersResp] = await Promise.all([
            fetch(questionUrl, { credentials: 'include' }),
            fetch(answersUrl, { credentials: 'include' }),
          ]);

          const [questionText, answersText] = await Promise.all([
            questionResp.text(),
            answersResp.text(),
          ]);

          if (!questionResp.ok || !answersResp.ok) {
            const status = !questionResp.ok ? questionResp.status : answersResp.status;
            return {
              ok: false,
              status,
              needsLogin: status === 401 || status === 403,
              body: (!questionResp.ok ? questionText : answersText).slice(0, 300)
            };
          }

          const question = JSON.parse(questionText);
          const answers = JSON.parse(answersText);
          const items = (answers?.data || []).map((item, index) => ({
            rank: index + 1,
            author: item?.author?.name || '',
            votes: item?.voteup_count ?? 0,
            excerpt: item?.excerpt || '',
            content: item?.content || '',
            createdTime: item?.created_time ? new Date(item.created_time * 1000).toISOString() : null,
            updatedTime: item?.updated_time ? new Date(item.updated_time * 1000).toISOString() : null,
            url: item?.url || ''
          }));

          return {
            ok: true,
            question: {
              id: question?.id == null ? id : String(question.id),
              title: question?.title || '',
              answerCount: question?.answer_count ?? 0,
              followerCount: question?.follower_count ?? 0,
              commentCount: question?.comment_count ?? 0,
              excerpt: question?.excerpt || '',
              url: 'https://www.zhihu.com/question/' + (question?.id == null ? id : String(question.id))
            },
            count: items.length,
            items,
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      await navigate(client, `https://www.zhihu.com/question/${encodeURIComponent(id)}`, 4000);
      const fallback = await evaluate(client, `
        (() => {
          const title = (document.querySelector('h1')?.textContent || '').trim();
          const emptyText = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
          const answerCards = [...document.querySelectorAll('[data-zop*="answer"]')]
            .slice(0, ${Math.max(1, limit)})
            .map((node, index) => ({
              rank: index + 1,
              author: (node.querySelector('.AuthorInfo-name')?.textContent || '').trim(),
              votes: Number((node.querySelector('button[aria-label*="赞同"]')?.textContent || '').replace(/[^\\d]/g, '')) || 0,
              excerpt: (node.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 220),
              url: location.href
            }));

          return {
            title,
            url: location.href,
            notFound: /没有知识存在的荒原/.test(emptyText),
            bodyText: emptyText.slice(0, 220),
            answers: answerCards
          };
        })()
      `);

      if (fallback?.title || (fallback?.answers || []).length || fallback?.notFound) {
        const notFound = Boolean(fallback?.notFound);
        process.stdout.write(`${JSON.stringify({
          ok: !notFound,
          id,
          notFound,
          message: notFound ? "Zhihu question page is unavailable or the question does not exist." : null,
          question: notFound ? null : {
            id,
            title: stripHtml(fallback.title),
            excerpt: stripHtml(fallback.bodyText).slice(0, 160),
            url: fallback.url,
          },
          count: notFound ? 0 : (fallback.answers || []).length,
          items: notFound ? [] : (fallback.answers || []).map((item) => ({
            rank: item.rank,
            author: item.author,
            votes: item.votes,
            excerpt: stripHtml(item.excerpt).slice(0, 160),
            url: item.url,
          })),
        }, null, 2)}\n`);
        process.exitCode = notFound ? 1 : 0;
        return;
      }

      process.stdout.write(`${JSON.stringify({
        ok: false,
        id,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Zhihu question requires a logged-in session in the shared agent browser."
          : "Zhihu question request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      question: {
        ...result.question,
        title: stripHtml(result.question?.title),
        excerpt: stripHtml(result.question?.excerpt).slice(0, 160),
      },
      count: result.count,
      items: (result.items || []).map((item) => ({
        rank: item.rank,
        author: item.author,
        votes: item.votes,
        excerpt: stripHtml(item.excerpt || item.content).slice(0, 160),
        createdTime: item.createdTime,
        updatedTime: item.updatedTime,
        url: item.url,
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
