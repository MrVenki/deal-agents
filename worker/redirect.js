// Cloudflare Worker: logs every outbound click, then redirects to the store.
//   /go?u=<base64url store url>&n=<niche>&p=<product id>&s=<source: site|telegram>
//   /stats  (Bearer STATS_TOKEN) -> counters per niche, product and source
//   /events (Bearer STATS_TOKEN) -> the most recent click events
// Needs a KV namespace bound as CLICKS and a secret STATS_TOKEN.
const ALLOWED_HOSTS = new Set([
  'www.amazon.in', 'amazon.in', 'amzn.to', 'amzn.in',
  'www.flipkart.com', 'dl.flipkart.com', 'fkrt.it', 'fkrt.cc',
]);
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|slurp|headless/i;
const SAFE = /^[\w-]{1,60}$/;
const EVENT_TTL = 60 * 60 * 24 * 90;

async function bump(env, key) {
  const n = parseInt((await env.CLICKS.get(key)) ?? '0', 10);
  await env.CLICKS.put(key, String(n + 1));
}

async function logClick(env, req, dest, niche, product, source) {
  const ts = Date.now();
  const event = {
    ts,
    niche,
    product,
    source,
    store: dest.hostname,
    country: req.cf?.country ?? null,
    referrer: req.headers.get('referer') ?? null,
  };
  await Promise.all([
    bump(env, `n:${niche}`),
    bump(env, `p:${product}`),
    bump(env, `s:${source}`),
    bump(env, `d:${new Date(ts).toISOString().slice(0, 10)}`),
    env.CLICKS.put(`e:${String(ts).padStart(14, '0')}:${Math.random().toString(36).slice(2, 6)}`, JSON.stringify(event), {
      expirationTtl: EVENT_TTL,
    }),
  ]);
}

async function counters(env, prefix) {
  const out = {};
  const { keys } = await env.CLICKS.list({ prefix });
  for (const k of keys) out[k.name.slice(prefix.length)] = parseInt((await env.CLICKS.get(k.name)) ?? '0', 10);
  return out;
}

const authorised = (req, env) => req.headers.get('authorization') === `Bearer ${env.STATS_TOKEN}`;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (url.pathname === '/go') {
      let dest;
      try {
        dest = new URL(Buffer.from(url.searchParams.get('u') ?? '', 'base64url').toString());
      } catch {
        return new Response('Bad link', { status: 400 });
      }
      if (dest.protocol !== 'https:' || !ALLOWED_HOSTS.has(dest.hostname)) return new Response('Blocked', { status: 400 });

      const pick = (k) => (SAFE.test(url.searchParams.get(k) ?? '') ? url.searchParams.get(k) : 'unknown');
      if (!BOT_UA.test(req.headers.get('user-agent') ?? '')) {
        ctx.waitUntil(logClick(env, req, dest, pick('n'), pick('p'), pick('s')));
      }
      return Response.redirect(dest.toString(), 302);
    }

    if (url.pathname === '/stats') {
      if (!authorised(req, env)) return new Response('Unauthorized', { status: 401 });
      const [niches, posts, sources, days] = await Promise.all(['n:', 'p:', 's:', 'd:'].map((p) => counters(env, p)));
      return Response.json({ niches, posts, sources, days });
    }

    if (url.pathname === '/events') {
      if (!authorised(req, env)) return new Response('Unauthorized', { status: 401 });
      const { keys } = await env.CLICKS.list({ prefix: 'e:', limit: 1000 });
      const recent = keys.slice(-100).reverse();
      const events = await Promise.all(recent.map(async (k) => JSON.parse((await env.CLICKS.get(k.name)) ?? 'null')));
      return Response.json({ events: events.filter(Boolean) });
    }

    return new Response('Not found', { status: 404 });
  },
};
