const AMAZON_HOST = /^(?:www\.)?amazon\.in$/;
const FLIPKART_HOST = /^(?:www\.)?flipkart\.com$/;

const hostOk = (re, url) => {
  try {
    return re.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

export const isAmazon = (url) => hostOk(AMAZON_HOST, url);
export const isFlipkart = (url) => hostOk(FLIPKART_HOST, url);

export function asinOf(url) {
  return new URL(url).pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?#]|$)/)?.[1] ?? null;
}

// Builds the outbound store URL for a deal, or null when we cannot do so safely.
// Amazon links are rebuilt from the ASIN so no foreign tags or tracking survive.
// Flipkart links pass through unchanged until a Flipkart affiliate account exists.
export function affiliateUrl(deal, cfg, niche) {
  if (deal.affiliateUrl) return deal.affiliateUrl;
  if (isFlipkart(deal.url)) return deal.url;
  if (!isAmazon(deal.url)) return null;
  const asin = asinOf(deal.url);
  if (!asin) return null;
  const tag = cfg.trackingIds?.[niche] || cfg.amazonTag;
  return `https://www.amazon.in/dp/${asin}?tag=${encodeURIComponent(tag)}`;
}

const b64url = (s) => Buffer.from(s).toString('base64url');

// Routes the click through our redirector (when configured) so every click is logged.
// source says where the click came from: "telegram" or "site".
export function trackedUrl(url, cfg, niche, productId, source = 'telegram') {
  if (!cfg.redirectBase) return url;
  const q = new URLSearchParams({ u: b64url(url), n: niche, p: productId, s: source });
  return `${cfg.redirectBase}/go?${q}`;
}
