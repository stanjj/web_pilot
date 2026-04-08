# web-pilot MCP Server — Setup Guide

web-pilot exposes all its CLI commands as **MCP tools** so Claude Desktop, Cursor,
Continue, Cline, and other MCP-native agents can call them directly — no shell exec,
no stdout parsing.

---

## Prerequisites

1. **Node.js ≥ 20** installed
2. The shared browser must be running before you invoke any tool that uses CDP:
   ```powershell
   node src/cli.mjs browser ensure --port 9223
   ```
   Tools that do not need a browser (e.g. public API commands) work without this.

---

## Starting the MCP Server

```powershell
# From the web-pilot repo root
npm run mcp:start
# or directly
node src/mcp-server.mjs
```

The server listens on **stdio** (standard for MCP). Logs go to stderr so they don't
interfere with the JSON-RPC protocol on stdout.

---

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "web-pilot": {
      "command": "node",
      "args": ["C:/path/to/web_pilot/src/mcp-server.mjs"]
    }
  }
}
```

Replace `C:/path/to/web_pilot` with the actual repo path. Restart Claude Desktop.

---

## Cursor

Add to `.cursor/mcp.json` (or open **Cursor → Settings → MCP → Add Server**):

```json
{
  "mcpServers": {
    "web-pilot": {
      "command": "node",
      "args": ["C:/path/to/web_pilot/src/mcp-server.mjs"]
    }
  }
}
```

---

## Continue / Cline

Add to your Continue or Cline config file:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["C:/path/to/web_pilot/src/mcp-server.mjs"]
        }
      }
    ]
  }
}
```

---

## Tool Naming Convention

CLI commands are exposed as MCP tools using the pattern:

```
{site}_{action}
```

Hyphens in site names are converted to underscores.

| CLI command                    | MCP tool name              |
|-------------------------------|----------------------------|
| `barchart quote`              | `barchart_quote`           |
| `yahoo-finance options`       | `yahoo_finance_options`    |
| `boss inbox`                  | `boss_inbox`               |
| `boss reply`                  | `boss_reply`               |
| `discord-app search`          | `discord_app_search`       |
| `browser ensure`              | `browser_ensure`           |

To see all available tools: `node src/cli.mjs --help` or list via MCP inspector.

---

## Calling a Tool

Every tool accepts the same input shape:

```json
{
  "flags": {
    "symbol": "QQQ",
    "port": "9223"
  },
  "extraArgs": []
}
```

`flags` maps to CLI `--flag value` pairs. `extraArgs` provides positional arguments
(rarely needed — most commands use flags only).

**Always include `"port": "9223"` in `flags`** for any command that connects to the
shared browser.

### Example: get a stock quote

```json
{
  "tool": "barchart_quote",
  "input": {
    "flags": { "symbol": "QQQ", "port": "9223" }
  }
}
```

### Example: read BOSS inbox

```json
{
  "tool": "boss_inbox",
  "input": {
    "flags": { "port": "9223" }
  }
}
```

---

## Output Format

All tools return a JSON string in the `text` content block:

```json
{
  "ok": true,
  "data": { ... },
  "meta": { "elapsedMs": 312, "command": "barchart quote" }
}
```

On failure:

```json
{
  "ok": false,
  "error": "Browser not running",
  "code": "BROWSER_NOT_RUNNING",
  "meta": { "elapsedMs": 12, "command": "boss inbox" }
}
```

---

## ⚠️ Write Command Warning

Some tools perform **write actions on real accounts** (sending messages, posting
replies, etc.). These are marked with ⚠️ in their tool description. Examples:

- `boss_reply` — sends a message in a BOSS chat thread
- `twitter_post` — posts a tweet
- `wechat_send` — sends a WeChat message

**Use these tools only with explicit intent.** An agent should confirm the content
with the user before invoking a write command.

---

## Testing with MCP Inspector

```powershell
npx @modelcontextprotocol/inspector node src/mcp-server.mjs
```

This opens a browser UI where you can list all tools, inspect their schemas, and
call them interactively.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Browser not running` error | Run `node src/cli.mjs browser ensure --port 9223` first |
| Tool returns `ok: false` with login error | Log in to the site in the shared browser profile, then retry |
| MCP server not discovered by Claude Desktop | Check the path in `claude_desktop_config.json`, restart Claude |
| `ECONNREFUSED` on port 9223 | The shared Chrome process stopped — re-run `browser ensure` |
