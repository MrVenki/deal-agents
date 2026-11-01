import { writeText } from './state.js';
import { disclosureFor } from './agents/compliance.js';
import { affiliateUrl, trackedUrl, isAmazon } from './links.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Regenerates the static product site (served from /docs by GitHub Pages).
// Every "view" button goes through the redirector so each click is logged.
export function renderSite(cfg, products) {
  const sections = cfg.niches
    .map((niche) => {
      const items = products
        .filter((p) => p.niche === niche.name)
        .map((p) => {
          const url = affiliateUrl(p, cfg, niche.name);
          if (!url) return '';
          const link = trackedUrl(url, cfg, niche.name, p.id, 'site');
          const store = isAmazon(url) ? 'Amazon' : 'Flipkart';
          return `<article>
  <h3>${esc(p.title)}</h3>
  <p>${esc(p.description ?? '')}</p>
  <p><a class="btn" rel="sponsored nofollow noopener" href="${esc(link)}">View on ${store}</a></p>
</article>`;
        })
        .join('\n');
      return items ? `<section><h2>${esc(niche.emoji)} ${esc(niche.label ?? niche.name)}</h2>\n${items}</section>` : '';
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.siteName)}</title>
<meta name="description" content="Handpicked smart locks, cameras, water purifiers, kitchen and home appliances for Indian homes. Links go to Amazon.in.">
<style>
:root{--bg:#fff;--fg:#1b1f23;--muted:#5b6670;--card:#f5f6f8;--accent:#0b5cad;--onaccent:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e8eaed;--muted:#9aa4ad;--card:#1e2328;--accent:#6cb2ff;--onaccent:#0b1622}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:16px}
section{margin:28px 0} h1{font-size:1.6rem} h2{font-size:1.25rem;margin:0 0 8px} h3{font-size:1.05rem;margin:0}
article{background:var(--card);border-radius:10px;padding:12px 16px;margin:10px 0}
article p{margin:.35rem 0}
.btn{display:inline-block;background:var(--accent);color:var(--onaccent);padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:600}
.disc{color:var(--muted);font-size:.85rem}
</style>
</head>
<body><main>
<h1>${esc(cfg.siteName)}</h1>
<p class="disc">Prices change often, so check the current price on the store. ${esc(disclosureFor('https://www.amazon.in/'))}</p>
${sections || '<p>No products yet.</p>'}
</main></body></html>
`;
  writeText('docs/index.html', html);
  writeText('docs/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  writeText(
    'docs/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(cfg.siteUrl)}/</loc></url></urlset>\n`,
  );
}
