import { writeText, today } from '../state.js';

// Pulls click counts from the Cloudflare redirector and feeds them back to the Strategist.
export async function analyze(cfg, state) {
  const token = process.env.STATS_TOKEN;
  if (!cfg.redirectBase || !token) {
    console.log('[analyst] redirector not configured, nothing to learn from yet');
    return;
  }
  const res = await fetch(`${cfg.redirectBase}/stats`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`stats HTTP ${res.status}`);
  const { niches = {} } = await res.json();

  for (const n of cfg.niches) {
    const s = (state.niches[n.name] ??= { posts: 0, clicks: 0 });
    s.clicks = niches[n.name] ?? 0;
  }

  const rows = cfg.niches
    .map((n) => {
      const s = state.niches[n.name];
      return `| ${n.name} | ${s.posts} | ${s.clicks} | ${(s.clicks / Math.max(1, s.posts)).toFixed(2)} |`;
    })
    .join('\n');
  writeText(
    'data/report.md',
    `# Niche report (${today()})\n\n| Niche | Posts | Clicks | Clicks/post |\n|---|---|---|---|\n${rows}\n`,
  );
  console.log('[analyst] report updated');
}
