# DealAgents

Autonomous affiliate-deal pipeline. Zero dependencies, runs free on GitHub Actions.

| Agent | File | Job |
|---|---|---|
| Strategist | `src/agents/strategist.js` | Explores niches, then favours the one with the most clicks per post |
| Deal finder | `src/agents/dealFinder.js` | Picks an unposted, monetisable deal for the niche |
| Writer | `src/agents/writer.js` | Claude Haiku draft (capped), template fallback |
| Compliance | `src/agents/compliance.js` | Blocks prices on Amazon, hype claims, stray links; adds disclosure |
| Publisher | `src/agents/publisher.js`, `src/site.js` | Telegram channel + static site in `docs/` |
| Analyst | `src/agents/analyst.js` | Reads clicks from the Cloudflare redirector, feeds the Strategist |

## Try it locally
```bash
npm test
npm run dry      # uses fixture deals, sends and saves nothing
```
Real runs refuse to use the `fixture` source, because its product links are fake.

## One-time setup (the only manual part)
1. **Real deal source (required).** Add a file in `src/sources/` that returns `{id, title, description, url}` (and `affiliateUrl` for non-Amazon stores) from an official feed such as the Flipkart affiliate API or Cuelinks, then set `"source"` in `config.json`. Do not scrape sites that forbid it.
2. **Config.** In `config.json` set `siteUrl`, confirm `amazonTag` (your Associates tracking ID).
3. **Telegram.** Create a bot with @BotFather, create a channel, add the bot as admin. Save `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (e.g. `@yourchannel`).
4. **GitHub.** Push this folder to a new repo, add the Telegram values (and optional `ANTHROPIC_API_KEY`, `STATS_TOKEN`) under Settings → Secrets → Actions. Enable Pages from the `main` branch `/docs` folder. Scheduled workflows pause after 60 days without repo activity; the agents' own commits count as activity.
5. **Click tracking (optional, enables learning).** `cd worker`, `npx wrangler kv namespace create CLICKS`, paste the id into `wrangler.toml`, `npx wrangler secret put STATS_TOKEN`, `npx wrangler deploy`, then set `redirectBase` in `config.json` to the worker URL.

## Safety rails
- Cost: GitHub Actions and Pages free tier, Cloudflare free tier, Claude capped at `limits.llmCallsPerDay` calls (about a rupee a day at most).
- Kill switch: set repo variable `AGENTS_PAUSED=1`, or `"paused": true` in `data/state.json`.
- Post caps: `limits.postsPerRun`, `limits.postsPerDay`.
- Amazon prices are never published (they must come from Amazon's own API); posts carry the Associates disclosure.
- The redirector only forwards to an allow-list of store hosts and does not count bot previews.
