// Picks which niche to post about: explore every niche a few times, then mostly
// exploit the best clicks-per-post, with a little random exploration.
export function pickNiche(cfg, state, rand = Math.random, exclude = []) {
  const names = cfg.niches.map((n) => n.name).filter((n) => !exclude.includes(n));
  if (!names.length) return null;
  const stat = (n) => (state.niches[n] ??= { posts: 0, clicks: 0 });

  const underExplored = names.filter((n) => stat(n).posts < cfg.strategy.explorePosts);
  if (underExplored.length) {
    return underExplored.reduce((a, b) => (stat(a).posts <= stat(b).posts ? a : b));
  }
  if (rand() < cfg.strategy.epsilon) return names[Math.floor(rand() * names.length)];
  const rate = (n) => stat(n).clicks / Math.max(1, stat(n).posts);
  return names.reduce((a, b) => (rate(a) >= rate(b) ? a : b));
}
