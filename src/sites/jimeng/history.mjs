import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectJimengPage, getJimengPort, getJimengUrl } from "./common.mjs";

export async function runJimengHistory(flags) {
  const limit = Number(flags.limit ?? 5);
  const port = getJimengPort(flags.port);
  const { client } = await connectJimengPage(port);

  try {
    await navigate(client, getJimengUrl(), 3500);
    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 5};
        try {
          const resp = await fetch('/mweb/v1/get_history?aid=513695&device_platform=web&region=cn&da_version=3.3.11&web_version=7.5.0&aigc_features=app_lip_sync', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cursor: '',
              count: limit,
              need_page_item: true,
              need_aigc_data: true,
              aigc_mode_list: ['workbench']
            })
          });
          const text = await resp.text();
          if (!resp.ok) {
            return {
              ok: false,
              status: resp.status,
              needsLogin: resp.status === 401 || resp.status === 403,
              body: text.slice(0, 300)
            };
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const items = data?.data?.history_list || [];
          const normalized = items.slice(0, limit).map((item) => {
            const params = item?.aigc_image_params?.text2image_params || {};
            const images = item?.image?.large_images || [];
            return {
              prompt: params.prompt || item?.common_attr?.title || 'N/A',
              model: params?.model_config?.model_name || 'unknown',
              status: item?.common_attr?.status === 102 ? 'completed' : 'pending',
              imageUrl: images[0]?.image_url || '',
              createdAt: new Date((item?.common_attr?.create_time || 0) * 1000).toISOString()
            };
          });

          return { ok: true, count: normalized.length, items: normalized };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Jimeng history requires a logged-in session in the shared agent browser."
          : "Jimeng history request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
