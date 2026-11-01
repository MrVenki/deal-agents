import { disclosureFor } from './compliance.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function telegramMessage(text, link, originalUrl) {
  const disclosure = disclosureFor(originalUrl);
  return `${esc(text)}\n\n<a href="${esc(link)}">View on the store</a>${disclosure ? `\n\n<i>${esc(disclosure)}</i>` : ''}`;
}

// Returns true when posted, false when skipped (not configured).
export async function postToTelegram(text, link, originalUrl) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.warn('[publisher] Telegram not configured, skipping channel post');
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
      text: telegramMessage(text, link, originalUrl),
      parse_mode: 'HTML',
    }),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}
