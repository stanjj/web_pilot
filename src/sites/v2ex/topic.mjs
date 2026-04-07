import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectV2exPage, getV2exPort, getV2exUrl } from "./common.mjs";

export async function runV2exTopic(flags) {
  const id = String(flags.id || "").trim();
  const port = getV2exPort(flags.port);
  if (!id) throw new Error("Missing required --id");
  const { client } = await connectV2exPage(port);
  try {
    await navigate(client, getV2exUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const [topicResp, replyResp] = await Promise.all([
            fetch('https://www.v2ex.com/api/topics/show.json?id=' + encodeURIComponent(${JSON.stringify(id)})),
            fetch('https://www.v2ex.com/api/replies/show.json?topic_id=' + encodeURIComponent(${JSON.stringify(id)}))
          ]);
          const topicText = await topicResp.text();
          const replyText = await replyResp.text();
          if (!topicResp.ok) return { ok: false, status: topicResp.status, body: topicText.slice(0, 300) };
          const topicData = JSON.parse(topicText);
          const replyData = replyResp.ok ? JSON.parse(replyText) : [];
          const topic = Array.isArray(topicData) ? topicData[0] : null;
          if (!topic) return { ok: false, status: 404, body: 'Topic not found' };
          return {
            ok: true,
            topic: {
              id: topic.id,
              title: topic.title || '',
              content: topic.content || '',
              member: topic.member?.username || '',
              node: topic.node?.name || '',
              replies: topic.replies ?? 0,
              url: topic.url || ''
            },
            replies: (Array.isArray(replyData) ? replyData : []).slice(0, 20).map((item, index) => ({
              rank: index + 1,
              member: item.member?.username || '',
              content: item.content || '',
              created: item.created ?? null
            }))
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, id, status: result?.status ?? null, message: "V2EX topic request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, topic: result.topic || {}, replies: result.replies || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
