import { affiliateUrl } from '../links.js';

const DAY = 24 * 60 * 60 * 1000;

// Finds a product for the niche that has not been posted recently and can be linked safely.
// Catalog products carry their own niche; feed deals are matched by niche keywords.
export function findDeal(deals, niche, cfg, state, now = Date.now()) {
  const cooldown = (cfg.limits.repostAfterDays ?? 36500) * DAY;
  const recent = new Set(state.posted.filter((p) => now - Date.parse(p.date) < cooldown).map((p) => p.dealId));
  const words = cfg.niches.find((n) => n.name === niche.name)?.keywords ?? [];
  return deals.find((d) => {
    if (recent.has(d.id)) return false;
    const matches = d.niche
      ? d.niche === niche.name
      : words.some((w) => `${d.title} ${d.description ?? ''}`.toLowerCase().includes(w));
    return matches && Boolean(affiliateUrl(d, cfg, niche.name));
  });
}
