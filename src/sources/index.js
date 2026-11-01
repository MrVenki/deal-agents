import { readJson } from '../state.js';

// A source returns [{ id, title, description?, url, affiliateUrl? }].
// Add a real feed (Flipkart affiliate API, Cuelinks, ...) by adding a file here
// and setting "source" in config.json. Never scrape sites that forbid it.
const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;|&gt;|&quot;|&#39;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function rss(cfg) {
  const out = [];
  for (const feed of cfg.rssFeeds ?? []) {
    try {
      const res = await fetch(feed, { headers: { 'user-agent': 'deal-agents/0.1' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const tag = (t) => decode(m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? '');
        const url = tag('link');
        if (url) out.push({ id: url, title: tag('title'), description: tag('description').slice(0, 300), url });
      }
    } catch (err) {
      console.warn(`[deal-finder] feed failed ${feed}: ${err.message}`);
    }
  }
  return out;
}

const fixture = async () => readJson('data/fixtures/deals.json', []);

const sources = { fixture, rss };

export async function fetchDeals(cfg) {
  const source = sources[cfg.source];
  if (!source) throw new Error(`Unknown source "${cfg.source}"`);
  return source(cfg);
}
