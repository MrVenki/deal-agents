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

// ---- call-back leads from the calculator site (POST /lead) ----
const LEADS_PER_IP_PER_DAY = 5;

async function notifyOwner(env, lead) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text =
    `New loan lead\n${lead.name} · ${lead.phone}\nCity: ${lead.city || '-'}\n` +
    `Amount: ₹${lead.amount.toLocaleString('en-IN')}\nPage: ${lead.page}`;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

async function handleLead(req, env, ctx) {
  const origin = env.SITE_ORIGIN ?? '';
  const cors = {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
  const reply = (body, status = 200) => Response.json(body, { status, headers: cors });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  if (!origin || req.headers.get('origin') !== origin) return reply({ error: 'origin' }, 403);

  let b;
  try {
    b = await req.json();
  } catch {
    return reply({ error: 'json' }, 400);
  }
  if (b.website) return reply({ ok: true }); // honeypot: pretend success, store nothing

  const phone = String(b.phone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone) || b.consent !== true) return reply({ error: 'invalid' }, 400);

  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const rlKey = `rl:${day}:${ip}`;
  const used = parseInt((await env.CLICKS.get(rlKey)) ?? '0', 10);
  if (used >= LEADS_PER_IP_PER_DAY) return reply({ error: 'rate' }, 429);
  await env.CLICKS.put(rlKey, String(used + 1), { expirationTtl: 86400 });

  const ts = Date.now();
  const lead = {
    ts,
    name,
    phone,
    city: String(b.city ?? '').trim().slice(0, 60),
    amount: Math.min(Math.max(Number(b.amount) || 0, 0), 1e9),
    page: String(b.page ?? '').slice(0, 200),
    country: req.cf?.country ?? null,
    consent: true,
  };
  await env.CLICKS.put(`l:${String(ts).padStart(14, '0')}:${Math.random().toString(36).slice(2, 6)}`, JSON.stringify(lead));
  ctx.waitUntil(notifyOwner(env, lead));
  return reply({ ok: true });
}

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

    if (url.pathname === '/lead') return handleLead(req, env, ctx);

    if (url.pathname === '/leads') {
      if (!authorised(req, env)) return new Response('Unauthorized', { status: 401 });
      const { keys } = await env.CLICKS.list({ prefix: 'l:', limit: 1000 });
      const leads = await Promise.all(keys.slice(-100).reverse().map(async (k) => JSON.parse((await env.CLICKS.get(k.name)) ?? 'null')));
      return Response.json({ count: keys.length, leads: leads.filter(Boolean) });
    }

    return new Response('Not found', { status: 404 });
  },
};
