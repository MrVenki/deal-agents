import { today } from '../state.js';

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function templatePost(deal, niche) {
  const body = deal.description ? clip(deal.description, 220) : '';
  return `${niche.emoji} ${clip(deal.title, 120)}\n${body}\nCheck the current price and reviews before you buy.`.trim();
}

// Uses Claude (cheapest model, hard daily call cap) and falls back to the template.
// The model only sees facts from the deal, and the Compliance agent re-checks its output.
export async function writePost(deal, niche, cfg, state) {
  const key = process.env.ANTHROPIC_API_KEY;
  const used = state.llm[today()] ?? 0;
  if (!key || used >= cfg.limits.llmCallsPerDay) return templatePost(deal, niche);

  state.llm = { [today()]: used + 1 };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.llm.model,
        max_tokens: cfg.llm.maxTokens,
        system:
          'You write short Telegram posts for an Indian home-products deals channel. ' +
          'Use ONLY the facts provided. Never state a price, discount, rating, stock level or urgency. ' +
          'No links, no disclosure text (added automatically). Max 350 characters, plain text, ' +
          `one emoji at the start, and end with two hashtags. Niche emoji suggestion: ${niche.emoji}`,
        messages: [{ role: 'user', content: `Title: ${deal.title}\nDetails: ${deal.description ?? ''}\nCategory: ${niche.name}` }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
    return text || templatePost(deal, niche);
  } catch (err) {
    console.warn(`[writer] LLM failed, using template: ${err.message}`);
    return templatePost(deal, niche);
  }
}
