# AGENTS

This repo is a CDP-first browser automation toolkit. Treat it as the production path. Do not default to Playwright MCP wrappers or site-specific ad hoc shells when this repo can do the job.

## Source Of Truth

- Shared browser model: one sandbox Chrome, many tabs.
- Default CDP port: `9223`.
- Default browser profile name: `agent`.
- Reuse the existing sandbox browser. Do not open a separate Chrome per site.
- Keep the sandbox browser minimized unless user input is required for login, QR scan, CAPTCHA, or manual verification.
- Keep total page tabs under `15`. If opening a new tab would exceed that, close the oldest non-system tab first.

## Operation Rules

Use these rules when running the toolkit or doing browser work.

1. Start from the shared browser:
   `node src/cli.mjs browser ensure --port 9223`
2. Reuse the shared browser for all sites.
3. Run site commands through:
   `node src/cli.mjs <site> <command> ... --port 9223`
4. If a site requires login, ask the user to log in inside the shared sandbox browser, then continue.
5. Keep the sandbox browser minimized by default.
6. Do not open a second Chrome instance just because another site is being added.
7. Prefer the shared logged-in browser over raw public fetch when a site is easier or more reliable that way.
8. If things are moving smoothly, continue without asking.
9. Do not send test, probe, placeholder, or obviously artificial messages to real people.
10. For any write action involving a real account, real inbox, or real conversation:
   - default to read-only or dry-run first
   - only send when the user explicitly wants the real action
   - use natural user-facing content that a normal person would actually send
   - never send verification text like `test`, `probe`, `cdp`, `hello from cdp`, or similar machine-looking content
   - if the content would look strange, embarrassing, or confusing to the recipient, do not send it
11. For BOSS:
   - store candidate preference and job-matching data in Chinese by default
   - communicate with recruiters in Chinese by default
   - only switch to English if the recruiter clearly uses English first or the role explicitly requires English communication

Only interrupt the user when input is actually needed:

- login
- QR scan
- CAPTCHA / anti-bot challenge
- 2FA / email / SMS verification

## Change Rules

Use these rules when making code changes in this repo.

- Prefer extending `cdp_everything` over adding external browser CLIs or wrappers.
- Keep changes thin and site-scoped.
- Reuse helpers under `src/core/` instead of duplicating CDP logic.
- Site implementations belong under `src/sites/<site>/`.
- Keep `src/cli.mjs` as the main entrypoint.
- Do not commit browser state. `profiles/` is local runtime state and is ignored on purpose.
- For real-world write actions, require an explicit safety boundary in the command design, such as `--dry-run` by default or a clear explicit send flag.
- Keep BOSS-specific candidate profile and filtering rules aligned with the Chinese profile config rather than scattering them across prompts or ad hoc notes.
- Keep `AGENTS.md` as the canonical instruction file. `CLAUDE.md` should only point here.

## Existing Conventions

- Main entrypoint: `node src/cli.mjs`
- Shared browser helper: `browser ensure`
- Site implementations live under `src/sites/<site>/`
- Shared CDP helpers live under `src/core/`

## File Layout

- Code: `src/`, `scripts/`
- Local runtime browser state: `profiles/`
- Project docs: `README.md`, `AGENTS.md`, `CLAUDE.md`
