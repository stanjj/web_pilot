# TODO

This file tracks the next work for `cdp_everything`.

## Goals

- Make the shared CDP browser workflow the default and reliable path.
- Increase the number of sites that are not just connected, but actually useful.
- Keep the repo operational for multiple agents with minimal coordination overhead.

## Current State

- Shared browser model is in place.
- Default browser port is `9223`.
- Sandbox browser is minimized through CDP after attach.
- Page-tab limit is enforced at `15`.
- Some sites are genuinely usable.
- Some sites only have `status`/login detection or are blocked by auth walls, rate limits, or anti-bot checks.

## Priority 0: Keep The Core Stable

- [ ] Verify `browser ensure` behavior from a cold start after a full Chrome shutdown.
- [ ] Verify shared browser reuse when multiple site commands run sequentially.
- [ ] Verify the tab-closing policy only closes safe non-system pages.
- [ ] Add a small smoke test command that checks:
  - CDP connectivity
  - shared browser attach
  - window minimization
  - tab count enforcement
- [ ] Confirm all commands behave correctly if the browser is already minimized.
- [ ] Confirm behavior when the shared browser profile is missing or corrupted.
- [ ] Handle the case where the CDP endpoint is alive but no attachable page targets exist.
- [ ] Add better error messages for:
  - browser not running
  - login required
  - anti-bot challenge
  - auth wall
  - API schema drift

## Priority 1: BOSS

Goal: make BOSS fully practical from this repo.

- [x] Add `boss reply` to send a message in the active thread.
- [ ] Add `boss open-thread` by index/name without needing a separate read command first.
- [x] Add `boss unread-count` extraction from the left conversation list.
- [x] Add `boss unread-by-thread` extraction.
- [ ] Add `boss mark-needs-reply` style logic output for triage.
- [ ] Improve thread matching:
  - exact company
  - exact recruiter
  - fuzzy name/company match
- [ ] Improve message parsing for:
  - system prompts
  - attachments/resume hints
  - placeholder items like `您正在与Boss...沟通`
- [ ] Add explicit login-state detection for BOSS home/chat/search pages.
- [ ] Add a one-command workflow for:
  - list recent chats
  - identify reply-needed threads
  - open one thread
- [ ] Add safer reply-mode guardrails so a send action is never triggered by a read command.

## Priority 2: Market Sites

### Barchart

- [ ] Add expiration selection for `barchart options`.
- [ ] Add contract filtering by:
  - call/put
  - expiry
  - strike range
  - moneyness
- [ ] Add symbol-specific flow analysis workflow instead of only global unusual-flow scans.
- [ ] Add a `barchart flow-symbol` command.
- [ ] Add better interpretation fields for flow:
  - premium rank
  - volume/open-interest ratio
  - near-ATM flag
  - near-expiry flag
- [ ] Add `put-call-ratio` extraction.
- [ ] Add `gamma-exposure` extraction.
- [ ] Add `max-pain` extraction.
- [ ] Add `vol-skew` extraction.
- [ ] Add a compact summary mode for fast market checks.

### Yahoo Finance

- [ ] Add expiration selection for `yahoo-finance options`.
- [ ] Add quote fallback parsing if the current page/API shape changes.
- [ ] Add richer chain output:
  - implied volatility
  - open interest
  - volume
  - bid/ask spread quality
- [ ] Add simple summary commands:
  - nearest expiry chain snapshot
  - ATM options snapshot
- [ ] Add a small compare mode for `SPY` vs `QQQ` vs a single stock.

### Xueqiu

- [ ] Add another useful command beyond `hot-stock`.
- [ ] Candidate commands:
  - search
  - quote/stock page summary
  - watchlist-like hot topic extraction

## Priority 3: Logged-In Productivity / AI Sites

These sites are connected but mostly shallow today.

### Chat / AI Tools

- [ ] Add at least one meaningful command each for:
  - `chatgpt`
  - `codex`
  - `cursor`
  - `chatwise`
  - `grok`
- [ ] Decide what "useful" means per site:
  - status only
  - inbox/session info
  - conversation listing
  - current-page extraction

### Productivity / Communication

- [ ] Add meaningful commands for:
  - `notion`
  - `discord-app`
  - `feishu`
  - `wechat`
- [ ] For `wechat`, add clear login-state reporting and post-login page extraction.
- [ ] For `discord-app`, add:
  - guild list
  - current channel info
  - unread indicator extraction if possible
- [ ] For `notion`, add:
  - current workspace/page title
  - sidebar page list extraction

## Priority 4: Public Content Sites

These already have at least one useful command, but coverage is still shallow.

### Add One More Useful Command For Each

- [ ] `reddit`: search or frontpage
- [ ] `hackernews`: new or ask/show listings
- [ ] `reuters`: latest headlines or topic page
- [ ] `bbc`: category-specific headlines
- [ ] `v2ex`: topic detail by ID
- [ ] `weibo`: hot detail page extraction
- [ ] `bilibili`: search
- [ ] `youtube`: channel or video detail parsing
- [ ] `smzdm`: hot deals page
- [ ] `xiaoyuzhou`: podcast episodes listing
- [ ] `zhihu`: question or hot item detail

## Priority 5: Auth-Walled Or Blocked Sites

These need a more deliberate plan.

### LinkedIn

- [ ] Improve auth-wall detection.
- [ ] Add post-login search results parsing.
- [ ] Add current-user/login-state command.

### Twitter

- [ ] Improve logged-out failure message.
- [ ] Add post-login trending or search workflow.
- [ ] Add current-user/login-state command.

### Xiaohongshu

- [ ] Improve login-wall handling.
- [ ] Add post-login search parsing.
- [ ] Add note detail parsing.

### Linux.do

- [ ] Investigate whether page-level parsing works better than current API path.
- [ ] Add Cloudflare-specific error messaging.
- [ ] Decide whether to keep or defer.

### Ctrip

- [ ] Re-check whether API instability is transient or structural.
- [ ] Try DOM parsing fallback.
- [ ] Decide whether this site should stay API-first or page-first.

### Jimeng

- [ ] Confirm whether the empty response is expected for the current session.
- [ ] Add better empty-state messaging.
- [ ] Add one more command only if there is real value.

### Antigravity

- [ ] Confirm whether the current target domain is actually valid.
- [ ] If the site is effectively dead/parked, mark it clearly in the manifest.

## Priority 6: CLI / DX

- [ ] Add a consistent `--json` output mode across all commands if any command still differs.
- [ ] Add a compact human-readable output mode for quick terminal use.
- [ ] Standardize option names across sites:
  - `--limit`
  - `--port`
  - `--query`
  - `--symbol`
  - `--type`
- [ ] Add help text coverage for all commands.
- [ ] Add per-site usage examples to the CLI help output.
- [ ] Add command-level exit codes for:
  - login required
  - browser unavailable
  - anti-bot blocked
  - invalid arguments

## Priority 7: Manifest / Metadata

- [ ] Expand `src/sites/manifest.json` from coarse status to richer metadata:
  - implemented commands
  - login required
  - public/read-only
  - blocked/degraded
  - notes
- [ ] Add a command to print:
  - all sites
  - usable sites
  - login-required sites
  - degraded sites
- [ ] Add a command to print "what should I log into next".

## Priority 8: Testing

- [ ] Add a lightweight smoke suite for a few representative sites:
  - `boss`
  - `barchart`
  - `yahoo-finance`
  - one public news site
- [ ] Add helper fixtures/mocks where possible for non-live parsing logic.
- [ ] Split parser logic from navigation logic more clearly where needed.
- [ ] Add regression tests for:
  - tab cap behavior
  - window minimization
  - login-required errors
  - manifest integrity

## Priority 9: Docs

- [ ] Update `README.md` with:
  - quick start
  - browser lifecycle
  - login expectations
  - site coverage snapshot
- [ ] Add a short "operator workflow" section:
  - ensure browser
  - log in when asked
  - run commands
- [ ] Add a "for other agents" section pointing to `AGENTS.md`.
- [ ] Document the difference between:
  - source code
  - local runtime state
  - ignored files
- [ ] Add examples for the most useful commands.

## Priority 10: Cleanup

- [ ] Review all site folders for duplicate helper logic that should move into `src/core/`.
- [ ] Check for dead code in placeholder-era helpers.
- [ ] Keep the tracked repo free of browser state and temp output.

## Suggested Next Actions

If continuing immediately, the highest-value next items are:

1. Add `boss reply`.
2. Add richer Barchart symbol-specific options/flow commands.
3. Improve manifest metadata and usability reporting.
4. Expand one meaningful command each for `notion`, `discord-app`, and `wechat`.
