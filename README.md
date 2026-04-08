# web-pilot

[![npm](https://img.shields.io/npm/v/web-pilot?color=blue)](https://www.npmjs.com/package/web-pilot)
[![stars](https://img.shields.io/github/stars/stanjj/web_pilot?style=social)](https://github.com/stanjj/web_pilot)
[![license](https://img.shields.io/github/license/stanjj/web_pilot)](LICENSE)
[![node](https://img.shields.io/node/v/web-pilot)](package.json)

> **One persistent Chrome. 40+ sites. Your real sessions — already logged in.**

Most browser automation tools spin up a cold, headless, easily-blocked browser for every task. **web-pilot doesn't.**

| Traditional approach | web-pilot |
|---|---|
| New browser per script | **One persistent Chrome, reused forever** |
| Login again every run | **Already logged in — your real session** |
| Headless, easily fingerprinted | **Your real profile + anti-detection patches** |
| API wrappers that break | **Direct CDP — no middleman, no abstractions** |
| One site per tool | **40+ sites, one CLI, zero cold-start** |

```sh
node src/cli.mjs browser ensure --port 9223   # one-time: start the shared browser
node src/cli.mjs browser smoke --port 9223    # verify CDP/attach/minimize/tab-cap
node src/cli.mjs barchart quote --symbol QQQ  # run anything, instantly
node src/cli.mjs --json twitter timeline --limit 20 | jq '.data[].text'
```

---

## Quickstart


```powershell
# 1. Start the shared browser (once per machine session)
node src/cli.mjs browser ensure --port 9223 --profile agent

# 2. Smoke-check the shared browser when needed
node src/cli.mjs browser smoke --port 9223

# 3. Run any command immediately
node src/cli.mjs hackernews top --limit 10 --port 9223
node src/cli.mjs barchart quote --symbol QQQ --port 9223
node src/cli.mjs xueqiu hot --limit 20 --port 9223

# 4. Machine-readable output for agents/scripts
node src/cli.mjs --json barchart flow --type unusual --limit 10 --port 9223

# 5. Start the MCP server for Claude Desktop / Cursor / Continue
npm run mcp:start

# 6. See everything available
node src/cli.mjs sites list
node src/cli.mjs sites coverage
```

MCP setup details live in `docs/mcp-setup.md`.

---

## Site Coverage — 40+ Sites

### 📈 Finance & Markets

| Site | Login | Commands |
|---|:---:|---|
| **barchart** | No | `quote`, `options`, `greeks`, `flow` |
| **yahoo-finance** | No | `quote`, `options`, `catalyst` |
| **xueqiu** | No | `quote`, `hot`, `watchlist` |
| **marketbeat** | No | `news`, unusual options activity |
| **insiderfinance** | Yes | Options flow data |
| **tradingview** | Yes | `status`, `quote` on public pages; `historical-flow`, `live-flow` via Pineify |
| **pineify** | Yes | TradingView-linked options flow |
| **unusual-whales** | Yes | Dark pool & options flow |
| **whalestream** | Yes | Whale options news & summary |

### 💬 Social & Forums

| Site | Login | Commands |
|---|:---:|---|
| **twitter / X** | Yes | `timeline`, `search`, `bookmarks`, `post`, `reply` |
| **discord-app** | Yes | `servers`, `channels`, `search` with filter flags |
| **reddit** | No | `subreddit`, `posts`, `comments`, `vote` |
| **hackernews** | No | `top` |
| **v2ex** | No | `hot`, `latest`, `topics` |
| **linux-do** | No | `topics`, `categories`, `search` |
| **weibo** | No | `hot` |
| **zhihu** | No | `hot`, `questions`, `articles` |

### 🇨🇳 Chinese Content & Social

| Site | Login | Commands |
|---|:---:|---|
| **xiaohongshu** | Yes | `search`, `feed`, creator tools |
| **bilibili** | Yes | `search`, `history`, `favorites` |
| **xiaoyuzhou** | No | Podcast episodes |
| **neteasemusic** | Yes | `search`, `playlist`, `playback` |
| **weread** | Yes | `search`, `shelf`, `notes`, `highlights` |

### 🤖 AI Tools

| Site | Login | Commands |
|---|:---:|---|
| **chatgpt** | Yes | Chat UI automation |
| **grok** | Yes | Chat UI automation |
| **cursor** | Yes | Chat UI automation |
| **codex** | Yes | Chat UI automation |
| **chatwise** | Yes | Chat UI automation |
| **antigravity** | Yes | Chat UI automation |
| **jimeng** | Yes | AI image generation (ByteDance) |

### 💼 Jobs & Career

| Site | Login | Commands |
|---|:---:|---|
| **boss** | Yes | `search`, `inbox`, `reply` (zhipin.com) |
| **linkedin** | Yes | `job search` |

### 🛠️ Productivity

| Site | Login | Commands |
|---|:---:|---|
| **feishu** | Yes | Lark/Feishu messaging |
| **notion** | Yes | `notes`, `search`, `sidebar` |
| **wechat** | Yes | `chats`, `contacts`, `messages` |

### 🛒 Shopping & Deals

| Site | Login | Commands |
|---|:---:|---|
| **coupang** | No | `search`, `add-to-cart` (gated) |
| **shopback** | No | `stores`, `deals`, `radar` |
| **smzdm** | No | Deal search |

### 🌐 News & Media

| Site | Login | Commands |
|---|:---:|---|
| **bbc** | No | RSS news feed |
| **reuters** | No | `search` |
| **youtube** | No | `search`, `transcripts`, `playback` |
| **apple-podcasts** | No | `search`, `browse` |

### ✈️ Travel

| Site | Login | Commands |
|---|:---:|---|
| **ctrip** | No | `search` |

---

## Architecture

```
node src/cli.mjs <site> <command> [flags] --port 9223
        │
        ▼
   parseFlags(argv)
        │
        ▼
   buildRegistry()          ← lazy dynamic import() per site, zero cold-start cost
        │
        ▼
   registry.resolve(site, action)
        │
        ▼
   handler(flags, extraArgs)
        │
        ├─► cdp.mjs          ← CDP WebSocket client (connect → command → disconnect)
        ├─► stealth.mjs       ← anti-detection patches, applied once, idempotent
        ├─► tab-policy.mjs    ← tab limit enforcement, oldest-tab eviction
        └─► output.mjs        ← { ok, data, meta } envelopes for --json mode

src/
├── cli.mjs                      ← thin entrypoint: parse → resolve → execute
├── command-registrations.mjs    ← all 40+ sites registered with lazy handlers
├── core/
│   ├── command-registry.mjs     ← CommandRegistry: register / resolve / list
│   ├── errors.mjs               ← CliError types + normalizeError() + exit codes
│   ├── output.mjs               ← toSuccess / toFailure JSON envelopes
│   ├── cdp.mjs                  ← CDP WebSocket client + DOM helpers
│   ├── stealth.mjs              ← anti-fingerprint patches (idempotent)
│   ├── tab-policy.mjs           ← tab overflow / auto-close logic
│   └── ui-site.mjs              ← generic read/write site adapters
└── sites/
    ├── manifest.json            ← site metadata: login required, status, notes
    └── <site>/                  ← per-site command implementations
```

**Key design properties:**
- `cli.mjs` is a thin shell — it never imports site code at startup
- All site handlers are lazily imported on first use — adding 10 more sites costs zero startup time
- Every command runs against the **already-open shared browser** — no spin-up, no login, no cold state
- `--json` wraps any command output in `{ ok, data, meta: { elapsedMs, command } }` — pipe directly to `jq` or any agent

---

## Browser Lifecycle

```
┌──────────────────────────────────────────────────────┐
│  Single shared Chrome — port 9223, profile: agent    │
│                                                      │
│  Tab 1: zhipin.com (boss)   ← logged in, persistent  │
│  Tab 2: barchart.com        ← no login needed        │
│  Tab 3: twitter.com         ← your real session      │
│  ...up to 15 tabs (configurable)                     │
└──────────────────────────────────────────────────────┘
           ▲
           │  CDP WebSocket (:9223)
           │
  node src/cli.mjs <any site> <any command>
```

- **One Chrome instance** — all sites, all tabs, all sessions
- Tab limit: **15** (set `CDP_EVERYTHING_MAX_TABS=N` to change). Oldest non-system tab auto-evicted
- Window auto-minimizes after attach. Set `CDP_EVERYTHING_AUTO_MINIMIZE=0` to keep visible
- Profile state lives in `profiles/<name>/` — git-ignored, never committed
- `browser smoke` verifies CDP reachability, attachability, minimization, and tab-cap enforcement in one command

```powershell
# Pre-open specific URLs at launch
node src/cli.mjs browser ensure --port 9223 --profile agent \
  --urls "https://www.zhipin.com/web/geek/chat,https://www.barchart.com" --show
```

---

## Login Strategy

Sites that require authentication read from your **already-logged-in session** in the shared browser. You log in once interactively; every subsequent CLI call just reads or acts on the live session.

| Needs Login | Sites |
|:---:|---|
| **Yes** | boss, twitter, discord-app, bilibili, wechat, feishu, notion, chatgpt, grok, cursor, codex, chatwise, antigravity, linkedin, xiaohongshu, neteasemusic, weread, jimeng, insiderfinance, pineify, tradingview, unusual-whales, whalestream |
| **No** | hackernews, barchart, yahoo-finance, xueqiu, marketbeat, reddit, v2ex, linux-do, zhihu, weibo, youtube, bbc, reuters, apple-podcasts, xiaoyuzhou, coupang, shopback, smzdm, ctrip |

TradingView `status` and `quote` work against public TradingView pages. `historical-flow` and `live-flow` still use the logged-in Pineify flow endpoints behind the scenes, so keep the shared browser session signed in there before running those flow commands.

> For login-required sites: open the shared browser, log in manually once, then use the CLI freely.

---

## Usage Examples

### Boss — Job search & outreach

```powershell
node src/cli.mjs boss search --query "backend engineer" --city shanghai --limit 5 --port 9223
node src/cli.mjs boss inbox --limit 10 --port 9223
node src/cli.mjs boss reply --index 2 --message "您好，看到贵司的职位很感兴趣" --dry-run --port 9223
node src/cli.mjs boss profile
```

`boss profile` reads `config/boss_profile.zh-CN.json` when present. On a clean checkout, it returns a built-in Chinese template with `source: "default-template"` and `configMissing: true` so you can inspect the expected shape before creating your local ignored config file.

Expected default profile shape:

```json
{
     "Boss默认沟通语言": "中文",
     "候选人": {
          "姓名": "",
          "当前城市": "",
          "目标城市": [],
          "目标岗位": ["后端", "基础设施", "平台工程"],
          "远程偏好": "中国远程",
          "年薪底线": 300000
     }
}
```

### Barchart — Options flow & quotes

```powershell
node src/cli.mjs barchart quote --symbol QQQ --port 9223
node src/cli.mjs barchart flow --type unusual --limit 20 --port 9223
node src/cli.mjs barchart options --symbol NVDA --type Call --expiry 2026-05-16 --limit 20 --port 9223
node src/cli.mjs barchart greeks --symbol SPY --port 9223
```

### Discord — Filtered message search

```powershell
# Search by user in a specific server
node src/cli.mjs discord-app search --server "顺哥的股市大家庭🏠" --user "alice" --limit 20 --port 9223

# Filter by content and channel
node src/cli.mjs discord-app search --query "deploy failed" --channel "release-room" --limit 10 --port 9223

# Time-bounded search
node src/cli.mjs discord-app search --has link --after 2026-04-01 --port 9223
```

### Twitter / X — Timeline & search

```powershell
node src/cli.mjs twitter timeline --limit 20 --port 9223
node src/cli.mjs twitter search --query "NVDA earnings" --limit 10 --port 9223
node src/cli.mjs twitter bookmarks --limit 50 --port 9223
```

### Multi-source market intelligence

```powershell
# Unusual options flow across 4 sources
node src/cli.mjs barchart flow --type unusual --limit 10 --port 9223
node src/cli.mjs unusual-whales flow --limit 10 --port 9223
node src/cli.mjs whalestream summary --port 9223

# Chinese market sentiment
node src/cli.mjs xueqiu hot --limit 20 --port 9223
node src/cli.mjs tradingview quote --symbol AAPL --exchange NASDAQ --port 9223
node src/cli.mjs tradingview historical-flow --symbol NVDA --limit 10 --port 9223
node src/cli.mjs weibo hot --port 9223
node src/cli.mjs zhihu hot --port 9223
```

### Structured JSON output — pipe to anything

```powershell
# All commands support --json
node src/cli.mjs --json barchart quote --symbol QQQ --port 9223 | jq .data
node src/cli.mjs --json discord-app search --query "alpha" --limit 5 --port 9223 | jq '.data[].content'
node src/cli.mjs --json hackernews top --limit 10 --port 9223 | jq '[.data[] | {title, url, points}]'

# Output shape: { ok: true, data: <payload>, meta: { elapsedMs, command } }
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CDP_EVERYTHING_MAX_TABS` | `15` | Maximum open tabs before auto-eviction |
| `CDP_EVERYTHING_AUTO_MINIMIZE` | `1` | Set to `0` to keep browser window visible |

---

## Development

```powershell
# Run all tests
npm test

# Check what's covered
node src/cli.mjs sites list
node src/cli.mjs sites coverage

# Add a new site
# 1. Create src/sites/<site>/index.mjs with exported command handlers
# 2. Register commands in src/command-registrations.mjs
# 3. Add metadata entry to src/sites/manifest.json
```

**Conventions:**
- All site logic lives under `src/sites/<site>/` — never bleed cross-site
- Shared CDP helpers belong in `src/core/` — write once, reuse everywhere
- Write operations default to `--dry-run` — explicit send flags required for real actions
- `src/cli.mjs` stays thin — no business logic in the entrypoint

---

## Safety Model

- **Read commands** are the default. Write commands are gated.
- **Boss reply**, **Twitter post**, and any inbox action default to `--dry-run` — real sends require `--send` or equivalent explicit flag.
- No credentials are ever stored by this toolkit. Session state lives in the browser profile only.
- `profiles/` is git-ignored. Never commit browser state.
