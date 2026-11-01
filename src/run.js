import { loadConfig, loadState, saveState, today } from './state.js';
import { fetchDeals } from './sources/index.js';
import { pickNiche } from './agents/strategist.js';
import { findDeal } from './agents/dealFinder.js';
import { writePost, templatePost } from './agents/writer.js';
import { check } from './agents/compliance.js';
import { postToTelegram } from './agents/publisher.js';
import { analyze } from './agents/analyst.js';
import { renderSite } from './site.js';
import { affiliateUrl, trackedUrl } from './links.js';

const mode = process.argv[2] ?? 'post';
const dry = process.argv.includes('--dry');
const cfg = loadConfig();
const state = loadState();

async function post() {
  if (state.paused || process.env.AGENTS_PAUSED === '1') return console.log('Paused (kill switch). Nothing posted.');

  const postedToday = state.posted.filter((p) => p.date === today()).length;
  const budget = Math.min(cfg.limits.postsPerRun, cfg.limits.postsPerDay - postedToday);
  if (budget <= 0) return console.log('Daily post limit reached.');

  if (cfg.source === 'fixture' && !dry) {
    return console.error('Refusing to publish: "fixture" deals have fake product links. Set a real "source" in config.json.');
  }

  const deals = await fetchDeals(cfg);
  console.log(`[deal-finder] ${deals.length} candidate deals from "${cfg.source}"`);

  const tried = [];
  let published = 0;
  while (published < budget) {
    const nicheName = pickNiche(cfg, state, Math.random, tried);
    if (!nicheName) break;
    tried.push(nicheName);
    const niche = cfg.niches.find((n) => n.name === nicheName);

    const deal = findDeal(deals, niche, cfg, state);
    if (!deal) {
      console.log(`[strategist] no fresh deal for ${nicheName}, trying another niche`);
      continue;
    }

    const url = affiliateUrl(deal, cfg, nicheName);
    let text = await writePost(deal, niche, cfg, state);
    let verdict = check(text, url, cfg);
    if (!verdict.ok) {
      console.warn(`[compliance] rejected draft (${verdict.issues}), retrying with template`);
      text = templatePost(deal, niche);
      verdict = check(text, url, cfg);
    }
    if (!verdict.ok) {
      console.warn(`[compliance] skipping "${deal.title}" (${verdict.issues})`);
      continue;
    }

    const id = `${Date.now().toString(36)}-${published}`;
    const link = trackedUrl(url, cfg, nicheName, id);
    console.log(`\n[${nicheName}] ${deal.title}\n${text}\n${link}\n`);

    if (!dry) {
      await postToTelegram(text, link, url);
      state.posted.push({ id, dealId: deal.id, niche: nicheName, date: today(), title: deal.title, text, url, link });
      (state.niches[nicheName] ??= { posts: 0, clicks: 0 }).posts += 1;
    }
    published += 1;
  }

  if (!dry) {
    renderSite(cfg, state);
    saveState(state);
  }
  console.log(`Done. ${published} post(s)${dry ? ' (dry run, nothing sent or saved)' : ''}.`);
}

if (mode === 'post') await post();
else if (mode === 'analyze') {
  await analyze(cfg, state);
  if (!dry) saveState(state);
} else {
  console.error(`Unknown mode "${mode}". Use post or analyze.`);
  process.exit(1);
}
