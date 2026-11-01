import { writeText } from './state.js';
import { disclosureFor } from './agents/compliance.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Regenerates the static site (served from /docs by GitHub Pages) from posted deals.
export function renderSite(cfg, state) {
  const posts = [...state.posted].reverse().slice(0, 100);
  const items = posts
    .map(
      (p) => `<article>
  <p class="meta">${esc(p.niche)} · ${esc(p.date)}</p>
  <h2>${esc(p.title)}</h2>
  <p>${esc(p.text).replace(/\n/g, '<br>')}</p>
  <p><a rel="sponsored nofollow noopener" href="${esc(p.link)}">View on the store</a></p>
  <p class="disc">${esc(disclosureFor(p.url))}</p>
</article>`,
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.siteName)}</title>
<meta name="description" content="Handpicked smart home, kitchen and home comfort finds for Indian homes. Affiliate links disclosed.">
<style>
:root{--bg:#fff;--fg:#1b1f23;--muted:#5b6670;--card:#f5f6f8;--link:#0b5cad}
@media (prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e8eaed;--muted:#9aa4ad;--card:#1e2328;--link:#6cb2ff}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:680px;margin:0 auto;padding:16px}
article{background:var(--card);border-radius:10px;padding:14px 16px;margin:14px 0}
h1{font-size:1.5rem} h2{font-size:1.1rem;margin:.2rem 0}
a{color:var(--link)} .meta,.disc{color:var(--muted);font-size:.85rem;margin:.2rem 0}
</style>
</head>
<body><main>
<h1>${esc(cfg.siteName)}</h1>
<p class="disc">Some links on this page are affiliate links. ${esc(disclosureFor('https://www.amazon.in/'))}</p>
${items || '<p>No deals posted yet.</p>'}
</main></body></html>
`;
  writeText('docs/index.html', html);
  writeText('docs/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  writeText(
    'docs/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(cfg.siteUrl)}/</loc></url></urlset>\n`,
  );
}
