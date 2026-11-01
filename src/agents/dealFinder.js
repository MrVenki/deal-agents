import { affiliateUrl } from '../links.js';

// Finds an unposted deal that matches the niche and can be monetised safely.
export function findDeal(deals, niche, cfg, state) {
  const seen = new Set(state.posted.map((p) => p.dealId));
  const words = cfg.niches.find((n) => n.name === niche.name)?.keywords ?? [];
  return deals.find((d) => {
    if (seen.has(d.id)) return false;
    const text = `${d.title} ${d.description ?? ''}`.toLowerCase();
    if (!words.some((w) => text.includes(w))) return false;
    return Boolean(affiliateUrl(d, cfg, niche.name));
  });
}
