import { CommandRegistry } from "./core/command-registry.mjs";
import { runSitePlaceholder } from "./core/site-placeholder.mjs";

/**
 * Canonical usage strings extracted from the original CLI.
 * Keyed by "site:action". Used by registration helpers so printUsage
 * restores the detailed --flag descriptions that were in the old cli.mjs.
 * @type {Record<string, string>}
 */
const USAGE = {
  // core
  "doctor:default":        "node src/cli.mjs doctor [--port 9223]",
  "browser:ensure":        "node src/cli.mjs browser ensure [--port 9223] [--profile agent] [--urls <comma-separated-urls>] [--show]",
  "browser:smoke":         "node src/cli.mjs browser smoke [--port 9223] [--url about:blank]",
  "sites:list":            "node src/cli.mjs sites list",
  "sites:coverage":        "node src/cli.mjs sites coverage",
  "market:scan":           "node src/cli.mjs market scan [--symbols SPY,QQQ,IWM,AAPL,NVDA,TSLA] [--limit 10] [--all] [--port 9223]",
  "market:drilldown":      "node src/cli.mjs market drilldown --symbol QQQ [--limit 5] [--port 9223]",
  // apple-podcasts
  "apple-podcasts:search":   "node src/cli.mjs apple-podcasts search --keyword <text> [--limit 10]",
  "apple-podcasts:top":      "node src/cli.mjs apple-podcasts top [--country us] [--limit 20]",
  "apple-podcasts:episodes": "node src/cli.mjs apple-podcasts episodes --id <podcast-id> [--limit 15]",
  "apple-podcasts:utils":    "node src/cli.mjs apple-podcasts utils --url <podcast-or-episode-url>",
  "apple-podcasts:utils.test": "node src/cli.mjs apple-podcasts utils.test",
  // antigravity
  "antigravity:status":       "node src/cli.mjs antigravity status [--port 9223]",
  "antigravity:read":         "node src/cli.mjs antigravity read [--port 9223]",
  "antigravity:model":        "node src/cli.mjs antigravity model [--port 9223]",
  "antigravity:dump":         "node src/cli.mjs antigravity dump [--port 9223]",
  "antigravity:extract-code": "node src/cli.mjs antigravity extract-code [--port 9223]",
  "antigravity:new":          "node src/cli.mjs antigravity new",
  "antigravity:send":         "node src/cli.mjs antigravity send --text <text>",
  "antigravity:watch":        "node src/cli.mjs antigravity watch [--port 9223]",
  // barchart
  "barchart:quote":          "node src/cli.mjs barchart quote --symbol QQQ [--port 9223]",
  "barchart:options":        "node src/cli.mjs barchart options --symbol QQQ [--type Call|Put] [--limit 20] [--expiration YYYY-MM-DD] [--strike-min <n>] [--strike-max <n>] [--moneyness atm|itm|otm] [--port 9223]",
  "barchart:greeks":         "node src/cli.mjs barchart greeks --symbol QQQ [--expiration YYYY-MM-DD] [--limit 10] [--port 9223]",
  "barchart:flow":           "node src/cli.mjs barchart flow [--type all|call|put] [--limit 20] [--port 9223]",
  "barchart:flow-symbol":    "node src/cli.mjs barchart flow-symbol --symbol QQQ [--type all|call|put] [--limit 20] [--port 9223]",
  "barchart:technicals":     "node src/cli.mjs barchart technicals --symbol QQQ [--port 9223]",
  "barchart:put-call-ratio": "node src/cli.mjs barchart put-call-ratio --symbol QQQ [--expiration YYYY-MM-DD] [--port 9223]",
  // bbc
  "bbc:news": "node src/cli.mjs bbc news [--limit 20] [--port 9223]",
  // bilibili
  "bilibili:hot":         "node src/cli.mjs bilibili hot [--limit 20] [--port 9223]",
  "bilibili:search":      "node src/cli.mjs bilibili search --keyword <text> [--type video|user] [--limit 20] [--port 9223]",
  "bilibili:history":     "node src/cli.mjs bilibili history [--limit 20] [--port 9223]",
  "bilibili:me":          "node src/cli.mjs bilibili me [--port 9223]",
  "bilibili:ranking":     "node src/cli.mjs bilibili ranking [--limit 20] [--port 9223]",
  "bilibili:dynamic":     "node src/cli.mjs bilibili dynamic [--limit 15] [--port 9223]",
  "bilibili:favorite":    "node src/cli.mjs bilibili favorite [--limit 20] [--page 1] [--port 9223]",
  "bilibili:feed":        "node src/cli.mjs bilibili feed [--limit 20] [--type all|video|article] [--port 9223]",
  "bilibili:following":   "node src/cli.mjs bilibili following [--uid <uid>] [--page 1] [--limit 50] [--port 9223]",
  "bilibili:subtitle":    "node src/cli.mjs bilibili subtitle --bvid <BV...> [--lang zh-CN] [--port 9223]",
  "bilibili:download":    "node src/cli.mjs bilibili download --bvid <BV...> [--output ./bilibili-downloads] [--quality best|1080p|720p|480p] [--port 9223]",
  "bilibili:user-videos": "node src/cli.mjs bilibili user-videos --uid <uid> [--order pubdate|click|stow] [--limit 20] [--port 9223]",
  // boss
  "boss:search":         "node src/cli.mjs boss search --query <text> [--city shanghai] [--limit 5] [--port 9223]",
  "boss:greet":          "node src/cli.mjs boss greet --security-id <id> --lid <lid> [--job-url <url>] [--port 9223]",
  "boss:profile":        "node src/cli.mjs boss profile",
  "boss:detail":         "node src/cli.mjs boss detail [--url <job-url>] [--job-id <security-id>] [--port 9223]",
  "boss:match-job":      "node src/cli.mjs boss match-job --query <text> [--city shanghai] [--limit 10] [--port 9223]",
  "boss:recent":         "node src/cli.mjs boss recent [--limit 10] [--port 9223]",
  "boss:needs-reply":    "node src/cli.mjs boss needs-reply [--limit 10] [--port 9223]",
  "boss:inbox":          "node src/cli.mjs boss inbox [--limit 10] [--port 9223]",
  "boss:unread-count":   "node src/cli.mjs boss unread-count [--port 9223]",
  "boss:unread-by-thread": "node src/cli.mjs boss unread-by-thread [--limit 20] [--port 9223]",
  "boss:thread":        "node src/cli.mjs boss thread (--index <n> | --name <text>) [--messages 20] [--port 9223]",
  "boss:reply":         "node src/cli.mjs boss reply (--index <n> | --name <text>) --message <text> [--dry-run] [--send] [--port 9223]",
  "boss:open-thread":   "node src/cli.mjs boss open-thread (--index <n> | --name <text>) [--port 9223]",
  "boss:login-state":   "node src/cli.mjs boss login-state [--area home|chat|search|all] [--port 9223]",
  "boss:triage":        "node src/cli.mjs boss triage [--messages 10] [--port 9223]",
  // chatgpt
  "chatgpt:status": "node src/cli.mjs chatgpt status [--port 9223]",
  "chatgpt:read":   "node src/cli.mjs chatgpt read [--port 9223]",
  "chatgpt:ask":    "node src/cli.mjs chatgpt ask --text <text>",
  "chatgpt:new":    "node src/cli.mjs chatgpt new",
  "chatgpt:send":   "node src/cli.mjs chatgpt send --text <text>",
  // chatwise
  "chatwise:status":     "node src/cli.mjs chatwise status [--port 9223]",
  "chatwise:read":       "node src/cli.mjs chatwise read [--port 9223]",
  "chatwise:history":    "node src/cli.mjs chatwise history [--port 9223]",
  "chatwise:model":      "node src/cli.mjs chatwise model [--port 9223]",
  "chatwise:export":     "node src/cli.mjs chatwise export [--output chatwise-export.md] [--port 9223]",
  "chatwise:ask":        "node src/cli.mjs chatwise ask --text <text>",
  "chatwise:new":        "node src/cli.mjs chatwise new",
  "chatwise:send":       "node src/cli.mjs chatwise send --text <text>",
  "chatwise:screenshot": "node src/cli.mjs chatwise screenshot",
  // codex
  "codex:status":       "node src/cli.mjs codex status [--port 9223]",
  "codex:read":         "node src/cli.mjs codex read [--port 9223]",
  "codex:history":      "node src/cli.mjs codex history [--port 9223]",
  "codex:model":        "node src/cli.mjs codex model [--port 9223]",
  "codex:export":       "node src/cli.mjs codex export [--output codex-export.md] [--port 9223]",
  "codex:dump":         "node src/cli.mjs codex dump [--port 9223]",
  "codex:extract-diff": "node src/cli.mjs codex extract-diff [--port 9223]",
  "codex:ask":          "node src/cli.mjs codex ask --text <text>",
  "codex:new":          "node src/cli.mjs codex new",
  "codex:send":         "node src/cli.mjs codex send --text <text>",
  "codex:screenshot":   "node src/cli.mjs codex screenshot",
  // coupang
  "coupang:search":      "node src/cli.mjs coupang search --query <text> [--limit 20] [--page 1] [--port 9223]",
  "coupang:add-to-cart": "node src/cli.mjs coupang add-to-cart --url <product-url>",
  // ctrip
  "ctrip:search": "node src/cli.mjs ctrip search --query <text> [--limit 15] [--port 9223]",
  // cursor
  "cursor:status":       "node src/cli.mjs cursor status [--port 9223]",
  "cursor:read":         "node src/cli.mjs cursor read [--port 9223]",
  "cursor:history":      "node src/cli.mjs cursor history [--port 9223]",
  "cursor:model":        "node src/cli.mjs cursor model [--port 9223]",
  "cursor:export":       "node src/cli.mjs cursor export [--output cursor-export.md] [--port 9223]",
  "cursor:dump":         "node src/cli.mjs cursor dump [--port 9223]",
  "cursor:extract-code": "node src/cli.mjs cursor extract-code [--port 9223]",
  "cursor:ask":          "node src/cli.mjs cursor ask --text <text>",
  "cursor:composer":     "node src/cli.mjs cursor composer --text <text>",
  "cursor:new":          "node src/cli.mjs cursor new",
  "cursor:send":         "node src/cli.mjs cursor send --text <text>",
  "cursor:screenshot":   "node src/cli.mjs cursor screenshot",
  // discord-app
  "discord-app:status":   "node src/cli.mjs discord-app status [--port 9223]",
  "discord-app:servers":  "node src/cli.mjs discord-app servers [--port 9223]",
  "discord-app:channels": "node src/cli.mjs discord-app channels [--port 9223]",
  "discord-app:members":  "node src/cli.mjs discord-app members [--port 9223]",
  "discord-app:read":     "node src/cli.mjs discord-app read [--port 9223]",
  "discord-app:search":   "node src/cli.mjs discord-app search [--server <name>] [--query <text>] [--user <name>] [--channel <name>] [--mentions <name>] [--has <type>] [--before YYYY-MM-DD] [--after YYYY-MM-DD] [--during YYYY-MM-DD] [--limit 20] [--port 9223]",
  "discord-app:send":     "node src/cli.mjs discord-app send --text <text>",
  // feishu
  "feishu:status": "node src/cli.mjs feishu status [--port 9223]",
  "feishu:read":   "node src/cli.mjs feishu read [--port 9223]",
  "feishu:search": "node src/cli.mjs feishu search --query <text> [--port 9223]",
  "feishu:new":    "node src/cli.mjs feishu new [--title <text>]",
  "feishu:send":   "node src/cli.mjs feishu send --text <text>",
  // grok
  "grok:status": "node src/cli.mjs grok status [--port 9223]",
  "grok:ask":    "node src/cli.mjs grok ask --text <text>",
  // hackernews
  "hackernews:top": "node src/cli.mjs hackernews top [--limit 20] [--port 9223]",
  // insiderfinance
  "insiderfinance:status": "node src/cli.mjs insiderfinance status [--port 9223]",
  "insiderfinance:flow":   "node src/cli.mjs insiderfinance flow [--limit 15] [--port 9223]",
  // jimeng
  "jimeng:history":  "node src/cli.mjs jimeng history [--limit 5] [--port 9223]",
  "jimeng:generate": "node src/cli.mjs jimeng generate --text <prompt>",
  // linkedin
  "linkedin:search": "node src/cli.mjs linkedin search --query <text> [--location <text>] [--limit 10] [--port 9223]",
  // linux-do
  "linux-do:hot":        "node src/cli.mjs linux-do hot [--period weekly] [--limit 20] [--port 9223]",
  "linux-do:latest":     "node src/cli.mjs linux-do latest [--limit 20] [--port 9223]",
  "linux-do:categories": "node src/cli.mjs linux-do categories [--limit 20] [--port 9223]",
  "linux-do:category":   "node src/cli.mjs linux-do category --slug <slug> --id <id> [--limit 20] [--port 9223]",
  "linux-do:search":     "node src/cli.mjs linux-do search --keyword <text> [--limit 20] [--port 9223]",
  "linux-do:topic":      "node src/cli.mjs linux-do topic --id <id> [--port 9223]",
  // marketbeat
  "marketbeat:status":       "node src/cli.mjs marketbeat status [--port 9223]",
  "marketbeat:news":         "node src/cli.mjs marketbeat news [--limit 20] [--port 9223]",
  "marketbeat:unusual-call": "node src/cli.mjs marketbeat unusual-call [--limit 20] [--min-change 200] [--port 9223]",
  "marketbeat:unusual-put":  "node src/cli.mjs marketbeat unusual-put [--limit 20] [--min-change 200] [--port 9223]",
  // neteasemusic
  "neteasemusic:status":   "node src/cli.mjs neteasemusic status [--port 9223]",
  "neteasemusic:search":   "node src/cli.mjs neteasemusic search --query <text> [--port 9223]",
  "neteasemusic:playlist": "node src/cli.mjs neteasemusic playlist [--id <playlist-id>] [--port 9223]",
  "neteasemusic:lyrics":   "node src/cli.mjs neteasemusic lyrics [--id <song-id>] [--port 9223]",
  "neteasemusic:playing":  "node src/cli.mjs neteasemusic playing [--port 9223]",
  "neteasemusic:play":     "node src/cli.mjs neteasemusic play --text <song-or-playlist>",
  "neteasemusic:next":     "node src/cli.mjs neteasemusic next",
  "neteasemusic:prev":     "node src/cli.mjs neteasemusic prev",
  "neteasemusic:like":     "node src/cli.mjs neteasemusic like --text <song>",
  "neteasemusic:volume":   "node src/cli.mjs neteasemusic volume --text <0-100>",
  // notion
  "notion:status":    "node src/cli.mjs notion status [--port 9223]",
  "notion:read":      "node src/cli.mjs notion read [--port 9223]",
  "notion:search":    "node src/cli.mjs notion search --query <text> [--port 9223]",
  "notion:sidebar":   "node src/cli.mjs notion sidebar [--port 9223]",
  "notion:favorites": "node src/cli.mjs notion favorites [--port 9223]",
  "notion:export":    "node src/cli.mjs notion export [--output notion-export.md] [--port 9223]",
  "notion:new":       "node src/cli.mjs notion new [--title <text>]",
  "notion:write":     "node src/cli.mjs notion write --text <text>",
  // pineify
  "pineify:status":           "node src/cli.mjs pineify status [--port 9223]",
  "pineify:historical-flow":  "node src/cli.mjs pineify historical-flow [--symbol AAPL] [--limit 20] [--port 9223]",
  "pineify:live-flow":        "node src/cli.mjs pineify live-flow [--symbols SPY,QQQ,AAPL] [--min-volume-ratio 2] [--limit 20] [--port 9223]",
  // reddit
  "reddit:hot":           "node src/cli.mjs reddit hot [--subreddit <name>] [--limit 20] [--port 9223]",
  "reddit:frontpage":     "node src/cli.mjs reddit frontpage [--limit 15] [--port 9223]",
  "reddit:popular":       "node src/cli.mjs reddit popular [--limit 20] [--port 9223]",
  "reddit:search":        "node src/cli.mjs reddit search --query <text> [--subreddit <name>] [--sort relevance|hot|top|new|comments] [--time all|day|week] [--limit 15] [--port 9223]",
  "reddit:subreddit":     "node src/cli.mjs reddit subreddit --name <subreddit> [--sort hot|new|top|rising|controversial] [--time all|day|week] [--limit 15] [--port 9223]",
  "reddit:read":          "node src/cli.mjs reddit read --post_id <url-or-id> [--sort best|top|new] [--limit 25] [--depth 2] [--replies 5] [--port 9223]",
  "reddit:user":          "node src/cli.mjs reddit user --username <name> [--port 9223]",
  "reddit:user-posts":    "node src/cli.mjs reddit user-posts --username <name> [--limit 15] [--port 9223]",
  "reddit:user-comments": "node src/cli.mjs reddit user-comments --username <name> [--limit 15] [--port 9223]",
  "reddit:saved":         "node src/cli.mjs reddit saved [--limit 15] [--port 9223]",
  "reddit:upvoted":       "node src/cli.mjs reddit upvoted [--limit 15] [--port 9223]",
  "reddit:comment":       "node src/cli.mjs reddit comment --post_id <id-or-url> --text <text>",
  "reddit:save":          "node src/cli.mjs reddit save --post_id <id-or-url> [--undo]",
  "reddit:subscribe":     "node src/cli.mjs reddit subscribe --subreddit <name> [--undo]",
  "reddit:upvote":        "node src/cli.mjs reddit upvote --post_id <id-or-url> [--direction up|down|none]",
  // reuters
  "reuters:search": "node src/cli.mjs reuters search --query <text> [--limit 10] [--port 9223]",
  // shopback
  "shopback:status":           "node src/cli.mjs shopback status [--port 9223]",
  "shopback:categories":       "node src/cli.mjs shopback categories [--limit 20] [--port 9223]",
  "shopback:category":         "node src/cli.mjs shopback category --slug <slug> [--keyword <text>] [--limit 15] [--port 9223]",
  "shopback:section-summary":  "node src/cli.mjs shopback section-summary [--slug digital-services] [--limit 10] [--port 9223]",
  "shopback:section":          "node src/cli.mjs shopback section --slug <slug> --section <name> [--sort auto|percent-only|dollar-only] [--limit 10] [--port 9223]",
  "shopback:stores":           "node src/cli.mjs shopback stores [--keyword <text>] [--limit 20] [--port 9223]",
  "shopback:store":            "node src/cli.mjs shopback store (--slug <slug> | --url <url>) [--limit 8] [--port 9223]",
  "shopback:compare":          "node src/cli.mjs shopback compare --stores amazon,temu,ebay [--port 9223]",
  "shopback:deals":            "node src/cli.mjs shopback deals (--slug <slug> | --url <url>) [--limit 8] [--port 9223]",
  "shopback:similar":          "node src/cli.mjs shopback similar (--slug <slug> | --url <url>) [--limit 8] [--port 9223]",
  "shopback:radar":            "node src/cli.mjs shopback radar [--slug digital-services] [--min-percent 30] [--min-dollar 30] [--limit 5] [--port 9223]",
  "shopback:finance-services": "node src/cli.mjs shopback finance-services [--limit 5] [--strict] [--tags tax,insurance] [--sort auto|percent-only|dollar-only] [--port 9223]",
  "shopback:tax-services":     "node src/cli.mjs shopback tax-services [--limit 10] [--sort auto|percent-only|dollar-only] [--port 9223]",
  "shopback:vpn-services":     "node src/cli.mjs shopback vpn-services [--limit 10] [--sort auto|percent-only|dollar-only] [--port 9223]",
  "shopback:telecom-services": "node src/cli.mjs shopback telecom-services [--limit 10] [--sort auto|percent-only|dollar-only] [--port 9223]",
  "shopback:digital-overview": "node src/cli.mjs shopback digital-overview [--limit 5] [--port 9223]",
  "shopback:top-cashback":     "node src/cli.mjs shopback top-cashback --slug <slug> [--sort auto|percent-only|dollar-only] [--limit 10] [--port 9223]",
  "shopback:alerts":           "node src/cli.mjs shopback alerts [--slug digital-services] [--section <name> | --sections <a,b>] [--min-percent 30] [--min-dollar 30] [--limit 10] [--port 9223]",
  // smzdm
  "smzdm:search": "node src/cli.mjs smzdm search --keyword <text> [--limit 20] [--port 9223]",
  // tradingview
  "tradingview:status": "node src/cli.mjs tradingview status [--port 9223]",
  "tradingview:quote": "node src/cli.mjs tradingview quote --symbol AAPL [--exchange NASDAQ] [--port 9223]",
  "tradingview:historical-flow": "node src/cli.mjs tradingview historical-flow [--symbol AAPL] [--limit 20] [--port 9223]",
  "tradingview:live-flow": "node src/cli.mjs tradingview live-flow [--symbols SPY,QQQ,AAPL] [--min-volume-ratio 2] [--limit 20] [--port 9223]",
  // twitter
  "twitter:trending":      "node src/cli.mjs twitter trending [--limit 20] [--port 9223]",
  "twitter:profile":       "node src/cli.mjs twitter profile --username <handle> [--port 9223]",
  "twitter:search":        "node src/cli.mjs twitter search --query <text> [--port 9223]",
  "twitter:thread":        "node src/cli.mjs twitter thread --url <tweet-url-or-id> [--port 9223]",
  "twitter:timeline":      "node src/cli.mjs twitter timeline [--tab for-you|following] [--port 9223]",
  "twitter:notifications": "node src/cli.mjs twitter notifications [--port 9223]",
  "twitter:bookmarks":     "node src/cli.mjs twitter bookmarks [--port 9223]",
  "twitter:followers":     "node src/cli.mjs twitter followers --username <handle> [--port 9223]",
  "twitter:following":     "node src/cli.mjs twitter following --username <handle> [--port 9223]",
  "twitter:article":       "node src/cli.mjs twitter article --url <tweet-url-or-id> [--port 9223]",
  "twitter:bookmark":      "node src/cli.mjs twitter bookmark --url <tweet-url-or-id>",
  "twitter:unbookmark":    "node src/cli.mjs twitter unbookmark --url <tweet-url-or-id>",
  "twitter:follow":        "node src/cli.mjs twitter follow --username <handle>",
  "twitter:unfollow":      "node src/cli.mjs twitter unfollow --username <handle>",
  "twitter:like":          "node src/cli.mjs twitter like --url <tweet-url-or-id>",
  "twitter:post":          "node src/cli.mjs twitter post --text <text>",
  "twitter:reply":         "node src/cli.mjs twitter reply --url <tweet-url-or-id> --text <text>",
  "twitter:reply-dm":      "node src/cli.mjs twitter reply-dm --username <handle> --text <text>",
  "twitter:accept":        "node src/cli.mjs twitter accept --username <handle>",
  "twitter:delete":        "node src/cli.mjs twitter delete --url <tweet-url-or-id>",
  "twitter:download":      "node src/cli.mjs twitter download --url <tweet-url-or-id>",
  // unusual-whales
  "unusual-whales:status": "node src/cli.mjs unusual-whales status [--port 9223]",
  "unusual-whales:news":   "node src/cli.mjs unusual-whales news [--limit 20] [--port 9223]",
  "unusual-whales:flow":   "node src/cli.mjs unusual-whales flow [--limit 20] [--min-premium 500000] [--port 9223]",
  // v2ex
  "v2ex:hot":           "node src/cli.mjs v2ex hot [--limit 20] [--port 9223]",
  "v2ex:latest":        "node src/cli.mjs v2ex latest [--limit 20] [--port 9223]",
  "v2ex:daily":         "node src/cli.mjs v2ex daily [--port 9223]",
  "v2ex:me":            "node src/cli.mjs v2ex me [--port 9223]",
  "v2ex:notifications": "node src/cli.mjs v2ex notifications [--limit 20] [--port 9223]",
  "v2ex:topic":         "node src/cli.mjs v2ex topic --id <id> [--port 9223]",
  // wechat
  "wechat:status":   "node src/cli.mjs wechat status [--port 9223]",
  "wechat:chats":    "node src/cli.mjs wechat chats [--port 9223]",
  "wechat:contacts": "node src/cli.mjs wechat contacts [--port 9223]",
  "wechat:read":     "node src/cli.mjs wechat read [--port 9223]",
  "wechat:search":   "node src/cli.mjs wechat search --query <text> [--port 9223]",
  "wechat:send":     "node src/cli.mjs wechat send --text <text>",
  // weibo
  "weibo:hot": "node src/cli.mjs weibo hot [--limit 30] [--port 9223]",
  // weread
  "weread:search":     "node src/cli.mjs weread search <keyword> [--limit 10]",
  "weread:ranking":    "node src/cli.mjs weread ranking [category] [--limit 20]",
  "weread:book":       "node src/cli.mjs weread book <bookId> [--port 9223]",
  "weread:shelf":      "node src/cli.mjs weread shelf [--limit 20] [--port 9223]",
  "weread:notebooks":  "node src/cli.mjs weread notebooks [--port 9223]",
  "weread:highlights": "node src/cli.mjs weread highlights <bookId> [--limit 20] [--port 9223]",
  "weread:notes":      "node src/cli.mjs weread notes <bookId> [--limit 20] [--port 9223]",
  "weread:utils":      "node src/cli.mjs weread utils [--bookId <id>]",
  "weread:utils.test": "node src/cli.mjs weread utils.test",
  // whalestream
  "whalestream:status":  "node src/cli.mjs whalestream status [--port 9223]",
  "whalestream:news":    "node src/cli.mjs whalestream news [--limit 20] [--port 9223]",
  "whalestream:summary": "node src/cli.mjs whalestream summary [--limit 10] [--port 9223]",
  // xiaohongshu
  "xiaohongshu:search":              "node src/cli.mjs xiaohongshu search --keyword <text> [--limit 20] [--port 9223]",
  "xiaohongshu:user":                "node src/cli.mjs xiaohongshu user --id <profile-url-or-id> [--limit 15] [--port 9223]",
  "xiaohongshu:creator-profile":     "node src/cli.mjs xiaohongshu creator-profile [--port 9223]",
  "xiaohongshu:creator-stats":       "node src/cli.mjs xiaohongshu creator-stats [--period seven|thirty] [--port 9223]",
  "xiaohongshu:creator-notes":       "node src/cli.mjs xiaohongshu creator-notes [--limit 20] [--port 9223]",
  "xiaohongshu:creator-note-detail": "node src/cli.mjs xiaohongshu creator-note-detail --note_id <id> [--port 9223]",
  "xiaohongshu:feed":                "node src/cli.mjs xiaohongshu feed [--limit 20] [--port 9223]",
  "xiaohongshu:notifications":       "node src/cli.mjs xiaohongshu notifications [--type mentions|likes|connections] [--limit 20] [--port 9223]",
  "xiaohongshu:user-helpers":        "node src/cli.mjs xiaohongshu user-helpers [--id <profile-url-or-id>] [--note_id <id>]",
  "xiaohongshu:user-helpers.test":   "node src/cli.mjs xiaohongshu user-helpers.test",
  "xiaohongshu:download":            "node src/cli.mjs xiaohongshu download --note_id <id> [--output ./xiaohongshu-downloads]",
  // xiaoyuzhou
  "xiaoyuzhou:podcast":          "node src/cli.mjs xiaoyuzhou podcast --id <podcast-id> [--port 9223]",
  "xiaoyuzhou:episode":          "node src/cli.mjs xiaoyuzhou episode --id <episode-id> [--port 9223]",
  "xiaoyuzhou:podcast-episodes": "node src/cli.mjs xiaoyuzhou podcast-episodes --id <podcast-id> [--limit 15] [--port 9223]",
  "xiaoyuzhou:utils":            "node src/cli.mjs xiaoyuzhou utils --url <podcast-or-episode-url>",
  "xiaoyuzhou:utils.test":       "node src/cli.mjs xiaoyuzhou utils.test",
  // xueqiu
  "xueqiu:hot-stock":  "node src/cli.mjs xueqiu hot-stock [--type 10|12] [--limit 20] [--port 9223]",
  "xueqiu:feed":       "node src/cli.mjs xueqiu feed [--page 1] [--limit 20] [--port 9223]",
  "xueqiu:hot":        "node src/cli.mjs xueqiu hot [--limit 20] [--port 9223]",
  "xueqiu:search":     "node src/cli.mjs xueqiu search --query <text> [--limit 10] [--port 9223]",
  "xueqiu:stock":      "node src/cli.mjs xueqiu stock --symbol <symbol> [--port 9223]",
  "xueqiu:watchlist":  "node src/cli.mjs xueqiu watchlist [--category 1|2|3] [--limit 20] [--port 9223]",
  // yahoo-finance
  "yahoo-finance:quote":          "node src/cli.mjs yahoo-finance quote --symbol QQQ [--port 9223]",
  "yahoo-finance:catalyst":       "node src/cli.mjs yahoo-finance catalyst --symbol QQQ [--limit 5] [--port 9223]",
  "yahoo-finance:options":        "node src/cli.mjs yahoo-finance options --symbol QQQ [--type calls|puts] [--limit 20] [--expiration YYYY-MM-DD|UNIX_TS] [--port 9223]",
  "yahoo-finance:chain-snapshot": "node src/cli.mjs yahoo-finance chain-snapshot --symbol QQQ [--limit 20] [--expiration YYYY-MM-DD|UNIX_TS] [--port 9223]",
  "yahoo-finance:atm":            "node src/cli.mjs yahoo-finance atm --symbol QQQ [--atm-window 5] [--expiration YYYY-MM-DD|UNIX_TS] [--port 9223]",
  "yahoo-finance:compare":        "node src/cli.mjs yahoo-finance compare [--symbols SPY,QQQ,AAPL] [--symbol <extra>] [--port 9223]",
  // youtube
  "youtube:search":              "node src/cli.mjs youtube search --query <text> [--limit 20] [--port 9223]",
  "youtube:tabs":                "node src/cli.mjs youtube tabs [--port 9223]",
  "youtube:play":                "node src/cli.mjs youtube play --url <youtube-url-or-id> [--port 9223] [--reuse-tab] [--target-id <id>]",
  "youtube:video":               "node src/cli.mjs youtube video --url <youtube-url-or-id> [--port 9223]",
  "youtube:transcript":          "node src/cli.mjs youtube transcript --url <youtube-url-or-id> [--lang en] [--mode grouped|raw] [--port 9223]",
  "youtube:transcript-group":    "node src/cli.mjs youtube transcript-group --url <youtube-url-or-id> [--lang en] [--port 9223]",
  "youtube:transcript-group.test": "node src/cli.mjs youtube transcript-group.test",
  "youtube:utils":               "node src/cli.mjs youtube utils --url <youtube-url-or-id>",
  // zhihu
  "zhihu:hot":           "node src/cli.mjs zhihu hot [--limit 20] [--port 9223]",
  "zhihu:search":        "node src/cli.mjs zhihu search --keyword <text> [--limit 10] [--port 9223]",
  "zhihu:question":      "node src/cli.mjs zhihu question --id <question-id> [--limit 5] [--port 9223]",
  "zhihu:download":      "node src/cli.mjs zhihu download --url <zhuanlan-url> [--output zhihu-articles] [--port 9223]",
  "zhihu:download.test": "node src/cli.mjs zhihu download.test",
};

/**
 * Build and populate the global command registry.
 * All site registrations are co-located here for explicitness.
 * Handlers use dynamic import() so modules load only when invoked.
 * @returns {CommandRegistry}
 */
export function buildRegistry() {
  const reg = new CommandRegistry();

  // ── core commands ──────────────────────────────────────────────

  reg.register({
    site: "doctor", action: "default", name: "doctor",
    description: "Run diagnostics",
    usage: "node src/cli.mjs doctor [--port 9223]",
    category: "core",
    handler: async (flags) => {
      const { runDoctor } = await import("./commands/doctor.mjs");
      await runDoctor(flags);
    },
  });

  reg.register({
    site: "browser", action: "ensure", name: "browser ensure",
    description: "Ensure shared browser is running",
    usage: "node src/cli.mjs browser ensure [--port 9223] [--profile agent] [--urls <comma-separated-urls>] [--show]",
    category: "core",
    handler: async (flags) => {
      const { runBrowserEnsure } = await import("./commands/browser-ensure.mjs");
      await runBrowserEnsure(flags);
    },
  });

  reg.register({
    site: "browser", action: "smoke", name: "browser smoke",
    description: "Run a lightweight shared-browser smoke check",
    usage: "node src/cli.mjs browser smoke [--port 9223] [--url about:blank]",
    category: "core",
    handler: async (flags) => {
      const { runBrowserSmoke } = await import("./commands/browser-smoke.mjs");
      await runBrowserSmoke(flags);
    },
  });

  reg.register({
    site: "sites", action: "list", name: "sites list",
    description: "List all supported sites",
    usage: "node src/cli.mjs sites list",
    category: "core",
    handler: async () => {
      const { runSitesList } = await import("./commands/sites.mjs");
      return runSitesList();
    },
  });

  reg.register({
    site: "sites", action: "coverage", name: "sites coverage",
    description: "Show site implementation coverage",
    usage: "node src/cli.mjs sites coverage",
    category: "core",
    handler: async () => {
      const { runSitesCoverage } = await import("./commands/sites-coverage.mjs");
      return runSitesCoverage();
    },
  });

  reg.register({
    site: "market", action: "scan", name: "market scan",
    description: "Multi-symbol market scan",
    usage: "node src/cli.mjs market scan [--symbols SPY,QQQ,...] [--limit 10] [--all] [--port 9223]",
    category: "finance",
    handler: async (flags) => {
      const { runMarketScan } = await import("./commands/market-scan.mjs");
      await runMarketScan(flags);
    },
  });

  reg.register({
    site: "market", action: "drilldown", name: "market drilldown",
    description: "Deep drilldown on a single symbol",
    usage: "node src/cli.mjs market drilldown --symbol QQQ [--limit 5] [--port 9223]",
    category: "finance",
    handler: async (flags) => {
      const { runMarketDrilldown } = await import("./commands/market-drilldown.mjs");
      await runMarketDrilldown(flags);
    },
  });

  // ── apple-podcasts ─────────────────────────────────────────────

  registerSimple(reg, "apple-podcasts", "search", "./sites/apple-podcasts/search.mjs", "runApplePodcastsSearch", { category: "media" });
  registerSimple(reg, "apple-podcasts", "top", "./sites/apple-podcasts/top.mjs", "runApplePodcastsTop", { category: "media" });
  registerSimple(reg, "apple-podcasts", "episodes", "./sites/apple-podcasts/episodes.mjs", "runApplePodcastsEpisodes", { category: "media" });
  registerSimple(reg, "apple-podcasts", "utils", "./sites/apple-podcasts/utils.mjs", "runApplePodcastsUtils", { category: "media" });
  registerSimple(reg, "apple-podcasts", "utils.test", "./sites/apple-podcasts/utils-test.mjs", "runApplePodcastsUtilsTest", { category: "media" });

  // ── antigravity ────────────────────────────────────────────────

  registerSimple(reg, "antigravity", "status", "./sites/antigravity/status.mjs", "runAntigravityStatus", { category: "ai" });
  registerUiRead(reg, "antigravity", "read", "./sites/antigravity/common.mjs", "connectAntigravityPage", "getAntigravityPort", "getAntigravityUrl", { category: "ai" });
  registerUiAction(reg, "antigravity", "model", "runUiModel", "./sites/antigravity/common.mjs", "connectAntigravityPage", "getAntigravityPort", "getAntigravityUrl", { category: "ai" });
  registerUiAction(reg, "antigravity", "dump", "runUiDump", "./sites/antigravity/common.mjs", "connectAntigravityPage", "getAntigravityPort", "getAntigravityUrl", { category: "ai" });
  registerUiAction(reg, "antigravity", "extract-code", "runUiExtractCode", "./sites/antigravity/common.mjs", "connectAntigravityPage", "getAntigravityPort", "getAntigravityUrl", { category: "ai" });
  registerUiGatedWrite(reg, "antigravity", "new", "Antigravity new session", { category: "ai" });
  registerUiGatedWrite(reg, "antigravity", "send", "Antigravity send", { category: "ai" });
  registerUiAction(reg, "antigravity", "watch", "runUiWatch", "./sites/antigravity/common.mjs", "connectAntigravityPage", "getAntigravityPort", "getAntigravityUrl", { category: "ai" });

  // ── barchart ───────────────────────────────────────────────────

  registerSimple(reg, "barchart", "quote", "./sites/barchart/quote.mjs", "runBarchartQuote", { category: "finance" });
  registerSimple(reg, "barchart", "options", "./sites/barchart/options.mjs", "runBarchartOptions", { category: "finance" });
  registerSimple(reg, "barchart", "greeks", "./sites/barchart/greeks.mjs", "runBarchartGreeks", { category: "finance" });
  registerSimple(reg, "barchart", "flow", "./sites/barchart/flow.mjs", "runBarchartFlow", { category: "finance" });
  registerSimple(reg, "barchart", "flow-symbol", "./sites/barchart/flow-symbol.mjs", "runBarchartFlowSymbol", { category: "finance" });
  registerSimple(reg, "barchart", "technicals", "./sites/barchart/technicals.mjs", "runBarchartTechnicals", { category: "finance" });
  registerSimple(reg, "barchart", "put-call-ratio", "./sites/barchart/put-call-ratio.mjs", "runBarchartPutCallRatio", { category: "finance" });

  // ── bilibili ───────────────────────────────────────────────────

  registerSimple(reg, "bilibili", "hot", "./sites/bilibili/hot.mjs", "runBilibiliHot", { category: "media" });
  registerSimple(reg, "bilibili", "search", "./sites/bilibili/search.mjs", "runBilibiliSearch", { category: "media" });
  registerSimple(reg, "bilibili", "history", "./sites/bilibili/history.mjs", "runBilibiliHistory", { category: "media" });
  registerSimple(reg, "bilibili", "me", "./sites/bilibili/me.mjs", "runBilibiliMe", { category: "media" });
  registerSimple(reg, "bilibili", "ranking", "./sites/bilibili/ranking.mjs", "runBilibiliRanking", { category: "media" });
  registerSimple(reg, "bilibili", "dynamic", "./sites/bilibili/dynamic.mjs", "runBilibiliDynamic", { category: "media" });
  registerSimple(reg, "bilibili", "favorite", "./sites/bilibili/favorite.mjs", "runBilibiliFavorite", { category: "media" });
  registerSimple(reg, "bilibili", "feed", "./sites/bilibili/feed.mjs", "runBilibiliFeed", { category: "media" });
  registerSimple(reg, "bilibili", "following", "./sites/bilibili/following.mjs", "runBilibiliFollowing", { category: "media" });
  registerSimple(reg, "bilibili", "subtitle", "./sites/bilibili/subtitle.mjs", "runBilibiliSubtitle", { category: "media" });
  registerSimple(reg, "bilibili", "download", "./sites/bilibili/download.mjs", "runBilibiliDownload", { category: "media" });
  registerSimple(reg, "bilibili", "user-videos", "./sites/bilibili/user-videos.mjs", "runBilibiliUserVideos", { category: "media" });

  // ── bbc ────────────────────────────────────────────────────────

  registerSimple(reg, "bbc", "news", "./sites/bbc/news.mjs", "runBbcNews", { category: "news" });

  // ── chatgpt ────────────────────────────────────────────────────

  registerSimple(reg, "chatgpt", "status", "./sites/chatgpt/status.mjs", "runChatgptStatus", { category: "ai" });
  registerUiRead(reg, "chatgpt", "read", "./sites/chatgpt/common.mjs", "connectChatgptPage", "getChatgptPort", "getChatgptUrl", { category: "ai" });
  registerUiGatedWrite(reg, "chatgpt", "ask", "ChatGPT ask", { category: "ai" });
  registerUiGatedWrite(reg, "chatgpt", "new", "ChatGPT new conversation", { category: "ai" });
  registerUiGatedWrite(reg, "chatgpt", "send", "ChatGPT send", { category: "ai" });

  // ── chatwise ───────────────────────────────────────────────────

  registerSimple(reg, "chatwise", "status", "./sites/chatwise/status.mjs", "runChatwiseStatus", { category: "ai" });
  registerUiRead(reg, "chatwise", "read", "./sites/chatwise/common.mjs", "connectChatwisePage", "getChatwisePort", "getChatwiseUrl", { category: "ai" });
  registerUiAction(reg, "chatwise", "history", "runUiHistory", "./sites/chatwise/common.mjs", "connectChatwisePage", "getChatwisePort", "getChatwiseUrl", { category: "ai" });
  registerUiAction(reg, "chatwise", "model", "runUiModel", "./sites/chatwise/common.mjs", "connectChatwisePage", "getChatwisePort", "getChatwiseUrl", { category: "ai" });
  registerUiAction(reg, "chatwise", "export", "runUiExport", "./sites/chatwise/common.mjs", "connectChatwisePage", "getChatwisePort", "getChatwiseUrl", { category: "ai" });
  registerUiGatedWrite(reg, "chatwise", "ask", "Chatwise ask", { category: "ai" });
  registerUiGatedWrite(reg, "chatwise", "new", "Chatwise new conversation", { category: "ai" });
  registerUiGatedWrite(reg, "chatwise", "send", "Chatwise send", { category: "ai" });
  registerUiAction(reg, "chatwise", "screenshot", "runUiScreenshot", "./sites/chatwise/common.mjs", "connectChatwisePage", "getChatwisePort", "getChatwiseUrl", { category: "ai" });

  // ── codex ──────────────────────────────────────────────────────

  registerSimple(reg, "codex", "status", "./sites/codex/status.mjs", "runCodexStatus", { category: "ai" });
  registerUiRead(reg, "codex", "read", "./sites/codex/common.mjs", "connectCodexPage", "getCodexPort", "getCodexUrl", { category: "ai" });
  registerUiAction(reg, "codex", "history", "runUiHistory", "./sites/codex/common.mjs", "connectCodexPage", "getCodexPort", "getCodexUrl", { category: "ai" });
  registerUiAction(reg, "codex", "model", "runUiModel", "./sites/codex/common.mjs", "connectCodexPage", "getCodexPort", "getCodexUrl", { category: "ai" });
  registerUiAction(reg, "codex", "export", "runUiExport", "./sites/codex/common.mjs", "connectCodexPage", "getCodexPort", "getCodexUrl", { category: "ai" });
  registerUiAction(reg, "codex", "dump", "runUiDump", "./sites/codex/common.mjs", "connectCodexPage", "getCodexPort", "getCodexUrl", { category: "ai" });
  registerUiAction(reg, "codex", "extract-diff", "runUiExtractDiff", "./sites/codex/common.mjs", "connectCodexPage", "getCodexPort", "getCodexUrl", { category: "ai" });
  registerUiGatedWrite(reg, "codex", "ask", "Codex ask", { category: "ai" });
  registerUiGatedWrite(reg, "codex", "new", "Codex new conversation", { category: "ai" });
  registerUiGatedWrite(reg, "codex", "send", "Codex send", { category: "ai" });
  registerUiAction(reg, "codex", "screenshot", "runUiScreenshot", "./sites/codex/common.mjs", "connectCodexPage", "getCodexPort", "getCodexUrl", { category: "ai" });

  // ── coupang ────────────────────────────────────────────────────

  registerSimple(reg, "coupang", "search", "./sites/coupang/search.mjs", "runCoupangSearch", { category: "shopping" });
  registerSimple(reg, "coupang", "add-to-cart", "./sites/coupang/add-to-cart.mjs", "runCoupangAddToCart", { category: "shopping" });

  // ── ctrip ──────────────────────────────────────────────────────

  registerSimple(reg, "ctrip", "search", "./sites/ctrip/search.mjs", "runCtripSearch", { category: "travel" });

  // ── cursor ─────────────────────────────────────────────────────

  registerSimple(reg, "cursor", "status", "./sites/cursor/status.mjs", "runCursorStatus", { category: "ai" });
  registerUiRead(reg, "cursor", "read", "./sites/cursor/common.mjs", "connectCursorPage", "getCursorPort", "getCursorUrl", { category: "ai" });
  registerUiAction(reg, "cursor", "history", "runUiHistory", "./sites/cursor/common.mjs", "connectCursorPage", "getCursorPort", "getCursorUrl", { category: "ai" });
  registerUiAction(reg, "cursor", "model", "runUiModel", "./sites/cursor/common.mjs", "connectCursorPage", "getCursorPort", "getCursorUrl", { category: "ai" });
  registerUiAction(reg, "cursor", "export", "runUiExport", "./sites/cursor/common.mjs", "connectCursorPage", "getCursorPort", "getCursorUrl", { category: "ai" });
  registerUiAction(reg, "cursor", "dump", "runUiDump", "./sites/cursor/common.mjs", "connectCursorPage", "getCursorPort", "getCursorUrl", { category: "ai" });
  registerUiAction(reg, "cursor", "extract-code", "runUiExtractCode", "./sites/cursor/common.mjs", "connectCursorPage", "getCursorPort", "getCursorUrl", { category: "ai" });
  registerUiGatedWrite(reg, "cursor", "ask", "Cursor ask", { category: "ai" });
  registerUiGatedWrite(reg, "cursor", "composer", "Cursor composer", { category: "ai" });
  registerUiGatedWrite(reg, "cursor", "new", "Cursor new conversation", { category: "ai" });
  registerUiGatedWrite(reg, "cursor", "send", "Cursor send", { category: "ai" });
  registerUiAction(reg, "cursor", "screenshot", "runUiScreenshot", "./sites/cursor/common.mjs", "connectCursorPage", "getCursorPort", "getCursorUrl", { category: "ai" });

  // ── discord-app ────────────────────────────────────────────────

  registerSimple(reg, "discord-app", "status", "./sites/discord-app/status.mjs", "runDiscordStatus", { category: "social" });
  registerSimple(reg, "discord-app", "servers", "./sites/discord-app/servers.mjs", "runDiscordServers", { category: "social" });
  registerSimple(reg, "discord-app", "channels", "./sites/discord-app/channels.mjs", "runDiscordChannels", { category: "social" });
  registerSimple(reg, "discord-app", "members", "./sites/discord-app/members.mjs", "runDiscordMembers", { category: "social" });
  registerSimple(reg, "discord-app", "read", "./sites/discord-app/read.mjs", "runDiscordRead", { category: "social" });
  registerSimple(reg, "discord-app", "search", "./sites/discord-app/search.mjs", "runDiscordSearch", { category: "social" });
  registerSimple(reg, "discord-app", "send", "./sites/discord-app/send.mjs", "runDiscordSend", { category: "social" });

  // ── feishu ─────────────────────────────────────────────────────

  registerSimple(reg, "feishu", "status", "./sites/feishu/status.mjs", "runFeishuStatus", { category: "productivity" });
  registerSimple(reg, "feishu", "read", "./sites/feishu/read.mjs", "runFeishuRead", { category: "productivity" });
  registerSimple(reg, "feishu", "search", "./sites/feishu/search.mjs", "runFeishuSearch", { category: "productivity" });
  registerSimple(reg, "feishu", "new", "./sites/feishu/new.mjs", "runFeishuNew", { category: "productivity" });
  registerSimple(reg, "feishu", "send", "./sites/feishu/send.mjs", "runFeishuSend", { category: "productivity" });

  // ── grok ───────────────────────────────────────────────────────

  registerSimple(reg, "grok", "status", "./sites/grok/status.mjs", "runGrokStatus", { category: "ai" });
  registerSimple(reg, "grok", "ask", "./sites/grok/ask.mjs", "runGrokAsk", { category: "ai" });

  // ── yahoo-finance ──────────────────────────────────────────────

  registerSimple(reg, "yahoo-finance", "quote", "./sites/yahoo-finance/quote.mjs", "runYahooFinanceQuote", { category: "finance" });
  registerSimple(reg, "yahoo-finance", "catalyst", "./sites/yahoo-finance/catalyst.mjs", "runYahooFinanceCatalyst", { category: "finance" });
  registerSimple(reg, "yahoo-finance", "options", "./sites/yahoo-finance/options.mjs", "runYahooFinanceOptions", { category: "finance" });
  registerSimple(reg, "yahoo-finance", "chain-snapshot", "./sites/yahoo-finance/chain-snapshot.mjs", "runYahooFinanceChainSnapshot", { category: "finance" });
  registerSimple(reg, "yahoo-finance", "atm", "./sites/yahoo-finance/chain-snapshot.mjs", "runYahooFinanceAtm", { category: "finance" });
  registerSimple(reg, "yahoo-finance", "compare", "./sites/yahoo-finance/compare.mjs", "runYahooFinanceCompare", { category: "finance" });

  // ── hackernews ─────────────────────────────────────────────────

  registerSimple(reg, "hackernews", "top", "./sites/hackernews/top.mjs", "runHackerNewsTop", { category: "news" });

  // ── jimeng ─────────────────────────────────────────────────────

  registerSimple(reg, "jimeng", "history", "./sites/jimeng/history.mjs", "runJimengHistory", { category: "ai" });
  registerSimple(reg, "jimeng", "generate", "./sites/jimeng/generate.mjs", "runJimengGenerate", { category: "ai" });

  // ── linkedin ───────────────────────────────────────────────────

  registerSimple(reg, "linkedin", "search", "./sites/linkedin/search.mjs", "runLinkedinSearch", { category: "social" });

  // ── linux-do ───────────────────────────────────────────────────

  registerSimple(reg, "linux-do", "hot", "./sites/linux-do/topics.mjs", "runLinuxDoHot", { category: "community" });
  registerSimple(reg, "linux-do", "latest", "./sites/linux-do/topics.mjs", "runLinuxDoLatest", { category: "community" });
  registerSimple(reg, "linux-do", "categories", "./sites/linux-do/categories.mjs", "runLinuxDoCategories", { category: "community" });
  registerSimple(reg, "linux-do", "category", "./sites/linux-do/category.mjs", "runLinuxDoCategory", { category: "community" });
  registerSimple(reg, "linux-do", "search", "./sites/linux-do/search.mjs", "runLinuxDoSearch", { category: "community" });
  registerSimple(reg, "linux-do", "topic", "./sites/linux-do/topic.mjs", "runLinuxDoTopic", { category: "community" });

  // ── marketbeat ─────────────────────────────────────────────────

  registerSimple(reg, "marketbeat", "status", "./sites/marketbeat/status.mjs", "runMarketBeatStatus", { category: "finance" });
  registerSimple(reg, "marketbeat", "news", "./sites/marketbeat/news.mjs", "runMarketBeatNews", { category: "finance" });

  reg.register({
    site: "marketbeat", action: "unusual-call", name: "marketbeat unusual-call",
    description: "Unusual call option volume",
    category: "finance",
    usage: USAGE["marketbeat:unusual-call"],
    handler: async (flags) => {
      const { runMarketBeatUnusualVolume } = await import("./sites/marketbeat/unusual-volume.mjs");
      await runMarketBeatUnusualVolume(flags, "call");
    },
  });

  reg.register({
    site: "marketbeat", action: "unusual-put", name: "marketbeat unusual-put",
    description: "Unusual put option volume",
    category: "finance",
    usage: USAGE["marketbeat:unusual-put"],
    handler: async (flags) => {
      const { runMarketBeatUnusualVolume } = await import("./sites/marketbeat/unusual-volume.mjs");
      await runMarketBeatUnusualVolume(flags, "put");
    },
  });

  // ── neteasemusic ───────────────────────────────────────────────

  registerSimple(reg, "neteasemusic", "status", "./sites/neteasemusic/status.mjs", "runNeteaseMusicStatus", { category: "media" });
  registerSimple(reg, "neteasemusic", "search", "./sites/neteasemusic/search.mjs", "runNeteaseMusicSearch", { category: "media" });
  registerSimple(reg, "neteasemusic", "playlist", "./sites/neteasemusic/playlist.mjs", "runNeteaseMusicPlaylist", { category: "media" });
  registerSimple(reg, "neteasemusic", "lyrics", "./sites/neteasemusic/lyrics.mjs", "runNeteaseMusicLyrics", { category: "media" });
  registerSimple(reg, "neteasemusic", "playing", "./sites/neteasemusic/playing.mjs", "runNeteaseMusicPlaying", { category: "media" });
  registerSimple(reg, "neteasemusic", "play", "./sites/neteasemusic/writes.mjs", "runNeteaseMusicPlay", { category: "media" });
  registerSimple(reg, "neteasemusic", "next", "./sites/neteasemusic/writes.mjs", "runNeteaseMusicNext", { category: "media" });
  registerSimple(reg, "neteasemusic", "prev", "./sites/neteasemusic/writes.mjs", "runNeteaseMusicPrev", { category: "media" });
  registerSimple(reg, "neteasemusic", "like", "./sites/neteasemusic/writes.mjs", "runNeteaseMusicLike", { category: "media" });
  registerSimple(reg, "neteasemusic", "volume", "./sites/neteasemusic/writes.mjs", "runNeteaseMusicVolume", { category: "media" });

  // ── notion ─────────────────────────────────────────────────────

  registerSimple(reg, "notion", "status", "./sites/notion/status.mjs", "runNotionStatus", { category: "productivity" });
  registerSimple(reg, "notion", "read", "./sites/notion/read.mjs", "runNotionRead", { category: "productivity" });
  registerSimple(reg, "notion", "search", "./sites/notion/search.mjs", "runNotionSearch", { category: "productivity" });
  registerSimple(reg, "notion", "sidebar", "./sites/notion/sidebar.mjs", "runNotionSidebar", { category: "productivity" });
  registerSimple(reg, "notion", "favorites", "./sites/notion/favorites.mjs", "runNotionFavorites", { category: "productivity" });
  registerSimple(reg, "notion", "export", "./sites/notion/export.mjs", "runNotionExport", { category: "productivity" });
  registerSimple(reg, "notion", "new", "./sites/notion/new.mjs", "runNotionNew", { category: "productivity" });
  registerSimple(reg, "notion", "write", "./sites/notion/write.mjs", "runNotionWrite", { category: "productivity" });

  // ── pineify ────────────────────────────────────────────────────

  registerSimple(reg, "pineify", "status", "./sites/pineify/status.mjs", "runPineifyStatus", { category: "finance" });
  registerSimple(reg, "pineify", "historical-flow", "./sites/pineify/historical-flow.mjs", "runPineifyHistoricalFlow", { category: "finance" });
  registerSimple(reg, "pineify", "live-flow", "./sites/pineify/live-flow.mjs", "runPineifyLiveFlow", { category: "finance" });

  // ── reddit ─────────────────────────────────────────────────────

  registerSimple(reg, "reddit", "hot", "./sites/reddit/hot.mjs", "runRedditHot", { category: "social" });
  registerSimple(reg, "reddit", "frontpage", "./sites/reddit/frontpage.mjs", "runRedditFrontpage", { category: "social" });
  registerSimple(reg, "reddit", "popular", "./sites/reddit/popular.mjs", "runRedditPopular", { category: "social" });
  registerSimple(reg, "reddit", "search", "./sites/reddit/search.mjs", "runRedditSearch", { category: "social" });
  registerSimple(reg, "reddit", "subreddit", "./sites/reddit/subreddit.mjs", "runRedditSubreddit", { category: "social" });
  registerSimple(reg, "reddit", "read", "./sites/reddit/read.mjs", "runRedditRead", { category: "social" });
  registerSimple(reg, "reddit", "user", "./sites/reddit/user.mjs", "runRedditUser", { category: "social" });
  registerSimple(reg, "reddit", "user-posts", "./sites/reddit/user-posts.mjs", "runRedditUserPosts", { category: "social" });
  registerSimple(reg, "reddit", "user-comments", "./sites/reddit/user-posts.mjs", "runRedditUserComments", { category: "social" });
  registerSimple(reg, "reddit", "saved", "./sites/reddit/saved.mjs", "runRedditSaved", { category: "social" });
  registerSimple(reg, "reddit", "upvoted", "./sites/reddit/saved.mjs", "runRedditUpvoted", { category: "social" });
  registerSimple(reg, "reddit", "comment", "./sites/reddit/writes.mjs", "runRedditComment", { category: "social" });
  registerSimple(reg, "reddit", "save", "./sites/reddit/writes.mjs", "runRedditSave", { category: "social" });
  registerSimple(reg, "reddit", "subscribe", "./sites/reddit/writes.mjs", "runRedditSubscribe", { category: "social" });
  registerSimple(reg, "reddit", "upvote", "./sites/reddit/writes.mjs", "runRedditUpvote", { category: "social" });

  // ── reuters ────────────────────────────────────────────────────

  registerSimple(reg, "reuters", "search", "./sites/reuters/search.mjs", "runReutersSearch", { category: "news" });

  // ── shopback ───────────────────────────────────────────────────

  registerSimple(reg, "shopback", "status", "./sites/shopback/status.mjs", "runShopbackStatus", { category: "shopping" });
  registerSimple(reg, "shopback", "categories", "./sites/shopback/categories.mjs", "runShopbackCategories", { category: "shopping" });
  registerSimple(reg, "shopback", "category", "./sites/shopback/category.mjs", "runShopbackCategory", { category: "shopping" });
  registerSimple(reg, "shopback", "section-summary", "./sites/shopback/section-summary.mjs", "runShopbackSectionSummary", { category: "shopping" });
  registerSimple(reg, "shopback", "section", "./sites/shopback/section.mjs", "runShopbackSection", { category: "shopping" });
  registerSimple(reg, "shopback", "stores", "./sites/shopback/stores.mjs", "runShopbackStores", { category: "shopping" });
  registerSimple(reg, "shopback", "store", "./sites/shopback/store.mjs", "runShopbackStore", { category: "shopping" });
  registerSimple(reg, "shopback", "compare", "./sites/shopback/compare.mjs", "runShopbackCompare", { category: "shopping" });
  registerSimple(reg, "shopback", "deals", "./sites/shopback/deals.mjs", "runShopbackDeals", { category: "shopping" });
  registerSimple(reg, "shopback", "similar", "./sites/shopback/similar.mjs", "runShopbackSimilar", { category: "shopping" });
  registerSimple(reg, "shopback", "radar", "./sites/shopback/radar.mjs", "runShopbackRadar", { category: "shopping" });
  registerSimple(reg, "shopback", "finance-services", "./sites/shopback/finance-services.mjs", "runShopbackFinanceServices", { category: "shopping" });
  registerSimple(reg, "shopback", "tax-services", "./sites/shopback/tax-services.mjs", "runShopbackTaxServices", { category: "shopping" });
  registerSimple(reg, "shopback", "vpn-services", "./sites/shopback/vpn-services.mjs", "runShopbackVpnServices", { category: "shopping" });
  registerSimple(reg, "shopback", "telecom-services", "./sites/shopback/telecom-services.mjs", "runShopbackTelecomServices", { category: "shopping" });
  registerSimple(reg, "shopback", "digital-overview", "./sites/shopback/digital-overview.mjs", "runShopbackDigitalOverview", { category: "shopping" });
  registerSimple(reg, "shopback", "top-cashback", "./sites/shopback/top-cashback.mjs", "runShopbackTopCashback", { category: "shopping" });
  registerSimple(reg, "shopback", "alerts", "./sites/shopback/alerts.mjs", "runShopbackAlerts", { category: "shopping" });

  // ── smzdm ──────────────────────────────────────────────────────

  registerSimple(reg, "smzdm", "search", "./sites/smzdm/search.mjs", "runSmzdmSearch", { category: "shopping" });

  // ── tradingview ────────────────────────────────────────────────

  registerSimple(reg, "tradingview", "status", "./sites/tradingview/status.mjs", "runTradingViewStatus", {
    category: "finance",
    description: "TradingView public site status",
  });
  registerSimple(reg, "tradingview", "quote", "./sites/tradingview/quote.mjs", "runTradingViewQuote", {
    category: "finance",
    description: "TradingView symbol page quote and metadata",
  });
  registerSimple(reg, "tradingview", "historical-flow", "./sites/tradingview/historical-flow.mjs", "runTradingViewHistoricalFlow", {
    category: "finance",
    description: "TradingView historical options flow (via Pineify)",
  });
  registerSimple(reg, "tradingview", "live-flow", "./sites/tradingview/live-flow.mjs", "runTradingViewLiveFlow", {
    category: "finance",
    description: "TradingView live options flow scan (via Pineify)",
  });

  // ── twitter ────────────────────────────────────────────────────

  registerSimple(reg, "twitter", "trending", "./sites/twitter/trending.mjs", "runTwitterTrending", { category: "social" });
  registerSimple(reg, "twitter", "profile", "./sites/twitter/profile.mjs", "runTwitterProfile", { category: "social" });
  registerSimple(reg, "twitter", "search", "./sites/twitter/search.mjs", "runTwitterSearch", { category: "social" });
  registerSimple(reg, "twitter", "thread", "./sites/twitter/thread.mjs", "runTwitterThread", { category: "social" });
  registerSimple(reg, "twitter", "timeline", "./sites/twitter/timeline.mjs", "runTwitterTimeline", { category: "social" });
  registerSimple(reg, "twitter", "notifications", "./sites/twitter/notifications.mjs", "runTwitterNotifications", { category: "social" });
  registerSimple(reg, "twitter", "bookmarks", "./sites/twitter/bookmarks.mjs", "runTwitterBookmarks", { category: "social" });
  registerSimple(reg, "twitter", "followers", "./sites/twitter/followers.mjs", "runTwitterFollowers", { category: "social" });
  registerSimple(reg, "twitter", "following", "./sites/twitter/following.mjs", "runTwitterFollowing", { category: "social" });
  registerSimple(reg, "twitter", "article", "./sites/twitter/article.mjs", "runTwitterArticle", { category: "social" });
  registerSimple(reg, "twitter", "bookmark", "./sites/twitter/writes.mjs", "runTwitterBookmark", { category: "social" });
  registerSimple(reg, "twitter", "unbookmark", "./sites/twitter/writes.mjs", "runTwitterUnbookmark", { category: "social" });
  registerSimple(reg, "twitter", "follow", "./sites/twitter/writes.mjs", "runTwitterFollow", { category: "social" });
  registerSimple(reg, "twitter", "unfollow", "./sites/twitter/writes.mjs", "runTwitterUnfollow", { category: "social" });
  registerSimple(reg, "twitter", "like", "./sites/twitter/writes.mjs", "runTwitterLike", { category: "social" });
  registerSimple(reg, "twitter", "post", "./sites/twitter/writes.mjs", "runTwitterPost", { category: "social" });
  registerSimple(reg, "twitter", "reply", "./sites/twitter/writes.mjs", "runTwitterReply", { category: "social" });
  registerSimple(reg, "twitter", "reply-dm", "./sites/twitter/writes.mjs", "runTwitterReplyDm", { category: "social" });
  registerSimple(reg, "twitter", "accept", "./sites/twitter/writes.mjs", "runTwitterAccept", { category: "social" });
  registerSimple(reg, "twitter", "delete", "./sites/twitter/writes.mjs", "runTwitterDelete", { category: "social" });
  registerSimple(reg, "twitter", "download", "./sites/twitter/writes.mjs", "runTwitterDownload", { category: "social" });

  // ── unusual-whales ─────────────────────────────────────────────

  registerSimple(reg, "unusual-whales", "status", "./sites/unusual-whales/status.mjs", "runUnusualWhalesStatus", { category: "finance" });
  registerSimple(reg, "unusual-whales", "news", "./sites/unusual-whales/news.mjs", "runUnusualWhalesNews", { category: "finance" });
  registerSimple(reg, "unusual-whales", "flow", "./sites/unusual-whales/flow.mjs", "runUnusualWhalesFlow", { category: "finance" });

  // ── v2ex ───────────────────────────────────────────────────────

  registerSimple(reg, "v2ex", "hot", "./sites/v2ex/hot.mjs", "runV2exHot", { category: "community" });
  registerSimple(reg, "v2ex", "latest", "./sites/v2ex/hot.mjs", "runV2exLatest", { category: "community" });
  registerSimple(reg, "v2ex", "daily", "./sites/v2ex/daily.mjs", "runV2exDaily", { category: "community" });
  registerSimple(reg, "v2ex", "me", "./sites/v2ex/me.mjs", "runV2exMe", { category: "community" });
  registerSimple(reg, "v2ex", "notifications", "./sites/v2ex/notifications.mjs", "runV2exNotifications", { category: "community" });
  registerSimple(reg, "v2ex", "topic", "./sites/v2ex/topic.mjs", "runV2exTopic", { category: "community" });

  // ── wechat ─────────────────────────────────────────────────────

  registerSimple(reg, "wechat", "status", "./sites/wechat/status.mjs", "runWechatStatus", { category: "social" });
  registerSimple(reg, "wechat", "chats", "./sites/wechat/chats.mjs", "runWechatChats", { category: "social" });
  registerSimple(reg, "wechat", "contacts", "./sites/wechat/contacts.mjs", "runWechatContacts", { category: "social" });
  registerSimple(reg, "wechat", "read", "./sites/wechat/read.mjs", "runWechatRead", { category: "social" });
  registerSimple(reg, "wechat", "search", "./sites/wechat/search.mjs", "runWechatSearch", { category: "social" });
  registerSimple(reg, "wechat", "send", "./sites/wechat/send.mjs", "runWechatSend", { category: "social" });

  // ── weibo ──────────────────────────────────────────────────────

  registerSimple(reg, "weibo", "hot", "./sites/weibo/hot.mjs", "runWeiboHot", { category: "social" });

  // ── weread (special: positional args) ──────────────────────────

  reg.register({
    site: "weread", action: "search", name: "weread search",
    description: "Search Weread books", category: "media",
    usage: USAGE["weread:search"],
    handler: async (flags, extraArgs) => {
      const { runWereadSearch } = await import("./sites/weread/search.mjs");
      await runWereadSearch({ ...flags, keyword: flags.keyword ?? extraArgs?.[0] });
    },
  });
  reg.register({
    site: "weread", action: "ranking", name: "weread ranking",
    description: "Weread book rankings", category: "media",
    usage: USAGE["weread:ranking"],
    handler: async (flags, extraArgs) => {
      const { runWereadRanking } = await import("./sites/weread/ranking.mjs");
      await runWereadRanking({ ...flags, category: flags.category ?? extraArgs?.[0] ?? "all" });
    },
  });
  reg.register({
    site: "weread", action: "book", name: "weread book",
    description: "View a Weread book", category: "media",
    usage: USAGE["weread:book"],
    handler: async (flags, extraArgs) => {
      const { runWereadBook } = await import("./sites/weread/book.mjs");
      await runWereadBook({ ...flags, bookId: flags.bookId ?? extraArgs?.[0] });
    },
  });
  registerSimple(reg, "weread", "shelf", "./sites/weread/shelf.mjs", "runWereadShelf", { category: "media" });
  registerSimple(reg, "weread", "notebooks", "./sites/weread/notebooks.mjs", "runWereadNotebooks", { category: "media" });
  reg.register({
    site: "weread", action: "highlights", name: "weread highlights",
    description: "View highlights for a book", category: "media",
    usage: USAGE["weread:highlights"],
    handler: async (flags, extraArgs) => {
      const { runWereadHighlights } = await import("./sites/weread/highlights.mjs");
      await runWereadHighlights({ ...flags, bookId: flags.bookId ?? extraArgs?.[0] });
    },
  });
  reg.register({
    site: "weread", action: "notes", name: "weread notes",
    description: "View notes for a book", category: "media",
    usage: USAGE["weread:notes"],
    handler: async (flags, extraArgs) => {
      const { runWereadNotes } = await import("./sites/weread/notes.mjs");
      await runWereadNotes({ ...flags, bookId: flags.bookId ?? extraArgs?.[0] });
    },
  });
  registerSimple(reg, "weread", "utils", "./sites/weread/utils.mjs", "runWereadUtils", { category: "media" });
  registerSimple(reg, "weread", "utils.test", "./sites/weread/utils-test.mjs", "runWereadUtilsTest", { category: "media" });

  // ── whalestream ────────────────────────────────────────────────

  registerSimple(reg, "whalestream", "status", "./sites/whalestream/status.mjs", "runWhaleStreamStatus", { category: "finance" });
  registerSimple(reg, "whalestream", "news", "./sites/whalestream/news.mjs", "runWhaleStreamNews", { category: "finance" });
  registerSimple(reg, "whalestream", "summary", "./sites/whalestream/summary.mjs", "runWhaleStreamSummary", { category: "finance" });

  // ── xiaohongshu ────────────────────────────────────────────────

  registerSimple(reg, "xiaohongshu", "search", "./sites/xiaohongshu/search.mjs", "runXiaohongshuSearch", { category: "social" });
  registerSimple(reg, "xiaohongshu", "user", "./sites/xiaohongshu/user.mjs", "runXiaohongshuUser", { category: "social" });
  registerSimple(reg, "xiaohongshu", "creator-profile", "./sites/xiaohongshu/creator-profile.mjs", "runXiaohongshuCreatorProfile", { category: "social" });
  registerSimple(reg, "xiaohongshu", "creator-stats", "./sites/xiaohongshu/creator-stats.mjs", "runXiaohongshuCreatorStats", { category: "social" });
  registerSimple(reg, "xiaohongshu", "creator-notes", "./sites/xiaohongshu/creator-notes.mjs", "runXiaohongshuCreatorNotes", { category: "social" });
  registerSimple(reg, "xiaohongshu", "creator-note-detail", "./sites/xiaohongshu/creator-note-detail.mjs", "runXiaohongshuCreatorNoteDetail", { category: "social" });
  registerSimple(reg, "xiaohongshu", "feed", "./sites/xiaohongshu/feed.mjs", "runXiaohongshuFeed", { category: "social" });
  registerSimple(reg, "xiaohongshu", "notifications", "./sites/xiaohongshu/notifications.mjs", "runXiaohongshuNotifications", { category: "social" });
  registerSimple(reg, "xiaohongshu", "user-helpers", "./sites/xiaohongshu/user-helpers.mjs", "runXiaohongshuUserHelpers", { category: "social" });
  registerSimple(reg, "xiaohongshu", "user-helpers.test", "./sites/xiaohongshu/user-helpers-test.mjs", "runXiaohongshuUserHelpersTest", { category: "social" });
  registerSimple(reg, "xiaohongshu", "download", "./sites/xiaohongshu/download.mjs", "runXiaohongshuDownload", { category: "social" });

  // ── xiaoyuzhou ─────────────────────────────────────────────────

  registerSimple(reg, "xiaoyuzhou", "podcast", "./sites/xiaoyuzhou/podcast.mjs", "runXiaoyuzhouPodcast", { category: "media" });
  registerSimple(reg, "xiaoyuzhou", "episode", "./sites/xiaoyuzhou/episode.mjs", "runXiaoyuzhouEpisode", { category: "media" });
  registerSimple(reg, "xiaoyuzhou", "podcast-episodes", "./sites/xiaoyuzhou/podcast-episodes.mjs", "runXiaoyuzhouPodcastEpisodes", { category: "media" });
  registerSimple(reg, "xiaoyuzhou", "utils", "./sites/xiaoyuzhou/utils.mjs", "runXiaoyuzhouUtils", { category: "media" });
  registerSimple(reg, "xiaoyuzhou", "utils.test", "./sites/xiaoyuzhou/utils-test.mjs", "runXiaoyuzhouUtilsTest", { category: "media" });

  // ── xueqiu ─────────────────────────────────────────────────────

  registerSimple(reg, "xueqiu", "hot-stock", "./sites/xueqiu/hot-stock.mjs", "runXueqiuHotStock", { category: "finance" });
  registerSimple(reg, "xueqiu", "feed", "./sites/xueqiu/feed.mjs", "runXueqiuFeed", { category: "finance" });
  registerSimple(reg, "xueqiu", "hot", "./sites/xueqiu/hot.mjs", "runXueqiuHot", { category: "finance" });
  registerSimple(reg, "xueqiu", "search", "./sites/xueqiu/search.mjs", "runXueqiuSearch", { category: "finance" });
  registerSimple(reg, "xueqiu", "stock", "./sites/xueqiu/stock.mjs", "runXueqiuStock", { category: "finance" });
  registerSimple(reg, "xueqiu", "watchlist", "./sites/xueqiu/watchlist.mjs", "runXueqiuWatchlist", { category: "finance" });

  // ── zhihu ──────────────────────────────────────────────────────

  registerSimple(reg, "zhihu", "hot", "./sites/zhihu/hot.mjs", "runZhihuHot", { category: "community" });
  registerSimple(reg, "zhihu", "search", "./sites/zhihu/search.mjs", "runZhihuSearch", { category: "community" });
  registerSimple(reg, "zhihu", "question", "./sites/zhihu/question.mjs", "runZhihuQuestion", { category: "community" });
  registerSimple(reg, "zhihu", "download", "./sites/zhihu/download.mjs", "runZhihuDownload", { category: "community" });
  registerSimple(reg, "zhihu", "download.test", "./sites/zhihu/download-test.mjs", "runZhihuDownloadTest", { category: "community" });

  // ── insiderfinance ─────────────────────────────────────────────

  registerSimple(reg, "insiderfinance", "status", "./sites/insiderfinance/status.mjs", "runInsiderFinanceStatus", { category: "finance" });
  registerSimple(reg, "insiderfinance", "flow", "./sites/insiderfinance/flow.mjs", "runInsiderFinanceFlow", { category: "finance" });

  // ── youtube ────────────────────────────────────────────────────

  registerSimple(reg, "youtube", "search", "./sites/youtube/search.mjs", "runYoutubeSearch", { category: "media" });
  registerSimple(reg, "youtube", "tabs", "./sites/youtube/tabs.mjs", "runYoutubeTabs", { category: "media" });
  registerSimple(reg, "youtube", "play", "./sites/youtube/play.mjs", "runYoutubePlay", { category: "media" });
  registerSimple(reg, "youtube", "video", "./sites/youtube/video.mjs", "runYoutubeVideo", { category: "media" });
  registerSimple(reg, "youtube", "transcript", "./sites/youtube/transcript.mjs", "runYoutubeTranscript", { category: "media" });
  registerSimple(reg, "youtube", "transcript-group", "./sites/youtube/transcript-group.mjs", "runYoutubeTranscriptGroup", { category: "media" });
  registerSimple(reg, "youtube", "transcript-group.test", "./sites/youtube/transcript-group-test.mjs", "runYoutubeTranscriptGroupTest", { category: "media" });
  registerSimple(reg, "youtube", "utils", "./sites/youtube/utils.mjs", "runYoutubeUtils", { category: "media" });

  // ── boss ───────────────────────────────────────────────────────

  reg.register({
    site: "boss", action: "search", name: "boss search",
    description: "Search BOSS jobs", category: "jobs",
    usage: USAGE["boss:search"],
    handler: async (flags) => {
      const { runBossSearch } = await import("./sites/boss/search.mjs");
      await runBossSearch(flags);
    },
  });
  reg.register({
    site: "boss", action: "greet", name: "boss greet",
    description: "Greet a recruiter on BOSS", category: "jobs",
    usage: USAGE["boss:greet"],
    handler: async (flags) => {
      const { runBossGreet } = await import("./sites/boss/greet.mjs");
      await runBossGreet(flags);
    },
  });
  reg.register({
    site: "boss", action: "profile", name: "boss profile",
    description: "View BOSS profile config", category: "jobs",
    usage: USAGE["boss:profile"],
    handler: async () => {
      const { runBossProfile } = await import("./sites/boss/profile.mjs");
      await runBossProfile();
    },
  });
  registerSimple(reg, "boss", "detail", "./sites/boss/detail.mjs", "runBossDetail", { category: "jobs" });
  reg.register({
    site: "boss", action: "match-job", name: "boss match-job",
    description: "Match jobs against profile", category: "jobs",
    usage: USAGE["boss:match-job"],
    handler: async (flags) => {
      const { runBossMatchJob } = await import("./sites/boss/match.mjs");
      await runBossMatchJob(flags);
    },
  });
  reg.register({
    site: "boss", action: "recent", name: "boss recent",
    description: "Recent BOSS conversations", category: "jobs",
    usage: USAGE["boss:recent"],
    handler: async (flags) => {
      const { runBossRecent } = await import("./sites/boss/inbox.mjs");
      await runBossRecent(flags);
    },
  });
  reg.register({
    site: "boss", action: "needs-reply", name: "boss needs-reply",
    description: "BOSS threads needing reply", category: "jobs",
    usage: USAGE["boss:needs-reply"],
    handler: async (flags) => {
      const { runBossNeedsReply } = await import("./sites/boss/inbox.mjs");
      await runBossNeedsReply(flags);
    },
  });
  reg.register({
    site: "boss", action: "inbox", name: "boss inbox",
    description: "BOSS inbox overview", category: "jobs",
    usage: USAGE["boss:inbox"],
    handler: async (flags) => {
      const { runBossInbox } = await import("./sites/boss/inbox.mjs");
      return runBossInbox(flags);
    },
  });
  reg.register({
    site: "boss", action: "unread-count", name: "boss unread-count",
    description: "Count unread BOSS messages", category: "jobs",
    usage: USAGE["boss:unread-count"],
    handler: async (flags) => {
      const { runBossUnreadCount } = await import("./sites/boss/inbox.mjs");
      await runBossUnreadCount(flags);
    },
  });
  reg.register({
    site: "boss", action: "unread-by-thread", name: "boss unread-by-thread",
    description: "Unread messages grouped by thread", category: "jobs",
    usage: USAGE["boss:unread-by-thread"],
    handler: async (flags) => {
      const { runBossUnreadByThread } = await import("./sites/boss/inbox.mjs");
      await runBossUnreadByThread(flags);
    },
  });
  registerSimple(reg, "boss", "thread", "./sites/boss/thread.mjs", "runBossThread", { category: "jobs" });
  registerSimple(reg, "boss", "reply", "./sites/boss/reply.mjs", "runBossReply", { category: "jobs", dryRunSupported: true });
  registerSimple(reg, "boss", "open-thread", "./sites/boss/open-thread.mjs", "runBossOpenThread", { category: "jobs" });
  registerSimple(reg, "boss", "login-state", "./sites/boss/login-state.mjs", "runBossLoginState", { category: "jobs" });
  registerSimple(reg, "boss", "triage", "./sites/boss/triage.mjs", "runBossTriage", {
    category: "jobs",
    description: "One-command triage: load inbox, open top needs-reply thread, return full context + nextStep hint",
  });

  return reg;
}

// ── Registration helpers ───────────────────────────────────────────

/**
 * Register a command that simply imports a module and calls a named export with (flags).
 */
function registerSimple(reg, site, action, modulePath, exportName, extra = {}) {
  reg.register({
    site,
    action,
    name: `${site} ${action}`,
    description: extra.description ?? `${site} ${action}`,
    category: extra.category,
    dryRunSupported: extra.dryRunSupported,
    usage: USAGE[`${site}:${action}`] ?? extra.usage,
    handler: async (flags) => {
      const mod = await import(modulePath);
      return mod[exportName](flags);
    },
  });
}

/**
 * Register a UI-site read command.
 */
function registerUiRead(reg, site, action, commonPath, connectFn, getPortFn, getUrlFn, extra = {}) {
  reg.register({
    site,
    action,
    name: `${site} ${action}`,
    description: extra.description ?? `${site} ${action}`,
    category: extra.category,
    usage: USAGE[`${site}:${action}`] ?? extra.usage,
    handler: async (flags) => {
      const core = await import("./core/ui-site.mjs");
      const common = await import(commonPath);
      await core.runUiRead(flags, { site, connectPage: common[connectFn], getPort: common[getPortFn], getUrl: common[getUrlFn] });
    },
  });
}

/**
 * Register a generic UI-site action (model, dump, history, etc.)
 */
function registerUiAction(reg, site, action, coreFnName, commonPath, connectFn, getPortFn, getUrlFn, extra = {}) {
  reg.register({
    site,
    action,
    name: `${site} ${action}`,
    description: extra.description ?? `${site} ${action}`,
    category: extra.category,
    usage: USAGE[`${site}:${action}`] ?? extra.usage,
    handler: async (flags) => {
      const core = await import("./core/ui-site.mjs");
      const common = await import(commonPath);
      await core[coreFnName](flags, { site, connectPage: common[connectFn], getPort: common[getPortFn], getUrl: common[getUrlFn] });
    },
  });
}

/**
 * Register a UI gated-write action (ask, send, new).
 */
function registerUiGatedWrite(reg, site, action, label, extra = {}) {
  reg.register({
    site,
    action,
    name: `${site} ${action}`,
    description: extra.description ?? `${site} ${action}`,
    category: extra.category,
    usage: USAGE[`${site}:${action}`] ?? extra.usage,
    handler: async (flags) => {
      const core = await import("./core/ui-site.mjs");
      await core.runUiGatedWrite(flags, { action, label });
    },
  });
}


