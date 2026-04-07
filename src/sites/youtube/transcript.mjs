import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYoutubePage, getYoutubePort } from "./common.mjs";

function parseVideoId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

export async function runYoutubeTranscript(flags) {
  const urlOrId = String(flags.url || "").trim();
  const videoId = parseVideoId(urlOrId);
  const lang = String(flags.lang || "").trim();
  const mode = String(flags.mode || "grouped").trim().toLowerCase();
  const port = getYoutubePort(flags.port);

  if (!videoId) {
    throw new Error("Missing required --url (YouTube URL or video ID)");
  }

  const { client } = await connectYoutubePage(port);

  try {
    await navigate(client, `https://www.youtube.com/watch?v=${videoId}`, 4500);

    const result = await evaluate(client, `
      (async () => {
        const cfg = window.ytcfg?.data_ || {};
        const apiKey = cfg.INNERTUBE_API_KEY;
        if (!apiKey) {
          return { ok: false, body: 'INNERTUBE_API_KEY not found on page' };
        }

        const resp = await fetch('/youtubei/v1/player?key=' + apiKey + '&prettyPrint=false', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
            videoId: ${JSON.stringify(videoId)}
          })
        });

        if (!resp.ok) {
          return { ok: false, body: 'InnerTube player API returned HTTP ' + resp.status };
        }

        const data = await resp.json();
        const renderer = data?.captions?.playerCaptionsTracklistRenderer;
        if (!renderer?.captionTracks?.length) {
          return { ok: false, body: 'No captions available for this video' };
        }

        const tracks = renderer.captionTracks;
        const langPref = ${JSON.stringify(lang)};
        let track = null;
        if (langPref) {
          track = tracks.find((t) => t.languageCode === langPref)
            || tracks.find((t) => t.languageCode.startsWith(langPref));
        }
        if (!track) {
          track = tracks.find((t) => t.kind !== 'asr') || tracks[0];
        }

        const captionResp = await fetch(track.baseUrl);
        const xml = await captionResp.text();
        if (!xml?.length) {
          return { ok: false, body: 'Caption URL returned empty response' };
        }

        function getAttr(tag, name) {
          const needle = name + '="';
          const idx = tag.indexOf(needle);
          if (idx === -1) return '';
          const valStart = idx + needle.length;
          const valEnd = tag.indexOf('"', valStart);
          if (valEnd === -1) return '';
          return tag.substring(valStart, valEnd);
        }

        function decodeEntities(s) {
          return s
            .replaceAll('&amp;', '&')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&quot;', '"')
            .replaceAll('&#39;', "'");
        }

        const isFormat3 = xml.includes('<p t="');
        const marker = isFormat3 ? '<p ' : '<text ';
        const endMarker = isFormat3 ? '</p>' : '</text>';
        const segments = [];
        let pos = 0;

        while (true) {
          const tagStart = xml.indexOf(marker, pos);
          if (tagStart === -1) break;
          let contentStart = xml.indexOf('>', tagStart);
          if (contentStart === -1) break;
          contentStart += 1;
          const tagEnd = xml.indexOf(endMarker, contentStart);
          if (tagEnd === -1) break;

          const attrStr = xml.substring(tagStart + marker.length, contentStart - 1);
          const content = xml.substring(contentStart, tagEnd);

          let startSec;
          let durSec;
          if (isFormat3) {
            startSec = (parseFloat(getAttr(attrStr, 't')) || 0) / 1000;
            durSec = (parseFloat(getAttr(attrStr, 'd')) || 0) / 1000;
          } else {
            startSec = parseFloat(getAttr(attrStr, 'start')) || 0;
            durSec = parseFloat(getAttr(attrStr, 'dur')) || 0;
          }

          const text = decodeEntities(content.replace(/<[^>]+>/g, '')).split('\\n').join(' ').trim();
          if (text) {
            segments.push({ index: segments.length + 1, start: startSec, end: startSec + durSec, text });
          }
          pos = tagEnd + endMarker.length;
        }

        if (!segments.length) {
          return { ok: false, body: 'Parsed 0 segments from caption XML' };
        }

        return {
          ok: true,
          language: track.languageCode,
          kind: track.kind || 'manual',
          items: segments
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        videoId,
        message: "YouTube transcript request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    const rawItems = result.items || [];
    const items = mode === "raw"
      ? rawItems.map((item) => ({
          index: item.index,
          start: `${Number(item.start).toFixed(2)}s`,
          end: `${Number(item.end).toFixed(2)}s`,
          text: item.text,
        }))
      : rawItems.map((item) => ({
          index: item.index,
          start: `${Math.floor(Number(item.start) / 60)}:${String(Math.floor(Number(item.start) % 60)).padStart(2, "0")}`,
          text: item.text,
        }));

    process.stdout.write(`${JSON.stringify({
      ok: true,
      videoId,
      language: result.language,
      kind: result.kind,
      mode,
      count: items.length,
      items,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
