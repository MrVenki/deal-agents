const AMAZON_HOST = /^(?:www\.)?amazon\.in$/;

export const isAmazon = (url) => {
  try {
    return AMAZON_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

export function asinOf(url) {
  return new URL(url).pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?#]|$)/)?.[1] ?? null;
}

// Builds the monetised URL for a deal, or null when we cannot do so safely.
// Amazon links are rebuilt from the ASIN so no foreign tags or tracking survive.
export function affiliateUrl(deal, cfg, niche) {
  if (deal.affiliateUrl) return deal.affiliateUrl;
  if (!isAmazon(deal.url)) return null;
  const asin = asinOf(deal.url);
  if (!asin) return null;
  const tag = cfg.trackingIds?.[niche] || cfg.amazonTag;
  return `https://www.amazon.in/dp/${asin}?tag=${encodeURIComponent(tag)}`;
}

const b64url = (s) => Buffer.from(s).toString('base64url');

// Routes the click through our redirector (when configured) so the Analyst can count it.
export function trackedUrl(url, cfg, niche, postId) {
  if (!cfg.redirectBase) return url;
  return `${cfg.redirectBase}/go?u=${b64url(url)}&n=${niche}&p=${postId}`;
}
