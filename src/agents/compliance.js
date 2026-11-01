import { isAmazon } from '../links.js';

export const AMAZON_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';
// Non-Amazon stores get no commission line until a real affiliate account is attached.
export const GENERIC_DISCLOSURE = '';

const BANNED = /guarantee|lowest price|cheapest|best price|price drop|only \d+ left|limited stock|hurry|last chance|act now|free money|100%/i;
// Amazon only allows prices that come from its own API, so never publish one.
const PRICE = /(?:₹|rs\.?|inr)\s?\d|\d+\s?% ?off|\bunder\s?\d{3,}|\bat\s?\d{3,}\b/i;

export const disclosureFor = (url) => (isAmazon(url) ? AMAZON_DISCLOSURE : GENERIC_DISCLOSURE);

// Returns { ok, issues }. A failed check means the post is never published.
export function check(text, url, cfg) {
  const issues = [];
  if (!text || text.length < 20) issues.push('too-short');
  if (text.length > cfg.limits.maxPostChars) issues.push('too-long');
  if (BANNED.test(text)) issues.push('banned-claim');
  if (isAmazon(url) && PRICE.test(text)) issues.push('price-on-amazon');
  if (/https?:\/\//i.test(text)) issues.push('link-in-body');
  if (isAmazon(url) && !/[?&]tag=/.test(url)) issues.push('missing-tag');
  return { ok: issues.length === 0, issues };
}
