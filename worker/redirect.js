// Cloudflare Worker: counts clicks per niche/post, then redirects to the store.
// Needs a KV namespace bound as CLICKS and a secret STATS_TOKEN.
const ALLOWED_HOSTS = new Set(['www.amazon.in', 'amazon.in', 'amzn.to', 'dl.flipkart.com', 'www.flipkart.com', 'fkrt.it']);
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|slurp/i;
const SAFE = /^[\w-]{1,40}$/;

async function bump(env, key) {
  const n = parseInt((await env.CLICKS.get(key)) ?? '0', 10);
  await env.CLICKS.put(key, String(n + 1));
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

      const niche = url.searchParams.get('n') ?? '';
      const post = url.searchParams.get('p') ?? '';
      if (!BOT_UA.test(req.headers.get('user-agent') ?? '')) {
        if (SAFE.test(niche)) ctx.waitUntil(bump(env, `n:${niche}`));
        if (SAFE.test(post)) ctx.waitUntil(bump(env, `p:${post}`));
      }
      return Response.redirect(dest.toString(), 302);
    }

    if (url.pathname === '/stats') {
      if (req.headers.get('authorization') !== `Bearer ${env.STATS_TOKEN}`) return new Response('Unauthorized', { status: 401 });
      const out = { niches: {}, posts: {} };
      for (const [prefix, bucket] of [['n:', out.niches], ['p:', out.posts]]) {
        const { keys } = await env.CLICKS.list({ prefix });
        for (const k of keys) bucket[k.name.slice(2)] = parseInt((await env.CLICKS.get(k.name)) ?? '0', 10);
      }
      return Response.json(out);
    }

    return new Response('Not found', { status: 404 });
  },
};
