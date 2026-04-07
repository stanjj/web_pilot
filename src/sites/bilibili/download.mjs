import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort } from "./common.mjs";

function runProcess(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => resolve({ ok: false, error: String(error) }));
    child.on("close", (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

export async function runBilibiliDownload(flags) {
  const bvid = String(flags.bvid || "").trim();
  const quality = String(flags.quality || "best").trim();
  const outputDir = path.resolve(process.cwd(), String(flags.output || "./bilibili-downloads").trim());
  const port = getBilibiliPort(flags.port);

  if (!bvid) {
    throw new Error("Missing required --bvid");
  }

  const versionCheck = await runProcess("yt-dlp", ["--version"]);
  if (!versionCheck.ok) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      bvid,
      title: "",
      status: "failed",
      size: "yt-dlp not installed or not on PATH",
    }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const { client } = await connectBilibiliPage(port);
  try {
    await navigate(client, `https://www.bilibili.com/video/${bvid}/`, 3500);
    const info = await evaluate(client, `
      (() => ({
        title: document.querySelector('h1.video-title, h1')?.textContent?.trim() || 'video'
      }))()
    `);

    await fs.mkdir(outputDir, { recursive: true });
    const formatArg = quality === "1080p"
      ? "bestvideo[height<=1080]+bestaudio/best[height<=1080]"
      : quality === "720p"
      ? "bestvideo[height<=720]+bestaudio/best[height<=720]"
      : quality === "480p"
      ? "bestvideo[height<=480]+bestaudio/best[height<=480]"
      : "best";

    const targetUrl = `https://www.bilibili.com/video/${bvid}/`;
    const result = await runProcess("yt-dlp", [
      "-f",
      formatArg,
      "-o",
      path.join(outputDir, `${bvid}_%(title)s.%(ext)s`),
      targetUrl,
    ]);

    process.stdout.write(`${JSON.stringify({
      ok: result.ok,
      bvid,
      title: info?.title || "",
      status: result.ok ? "success" : "failed",
      size: result.ok ? "downloaded" : (result.stderr || result.error || "yt-dlp failed").slice(0, 300),
      outputDir,
    }, null, 2)}\n`);

    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}
