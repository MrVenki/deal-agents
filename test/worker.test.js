import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/redirect.js';

const ORIGIN = 'https://mrvenki.github.io';
const kv = () => {
  const m = new Map();
  return {
    m,
    get: async (k) => m.get(k) ?? null,
    put: async (k, v) => void m.set(k, v),
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
  };
};
const ctx = { waitUntil: () => {} };
const post = (body, origin = ORIGIN) =>
  new Request('https://w.example/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': '1.2.3.4' },
    body: JSON.stringify(body),
  });
const good = { name: 'Asha', phone: '+91 98765 43210', city: 'Pune', amount: 5000000, consent: true, page: '/x/' };

test('valid lead is stored with a normalised phone number', async () => {
  const env = { CLICKS: kv(), SITE_ORIGIN: ORIGIN };
  const res = await worker.fetch(post(good), env, ctx);
  assert.equal(res.status, 200);
  const stored = JSON.parse([...env.CLICKS.m].find(([k]) => k.startsWith('l:'))[1]);
  assert.equal(stored.phone, '9876543210');
});

test('lead needs consent, a valid phone, and the right origin', async () => {
  const env = { CLICKS: kv(), SITE_ORIGIN: ORIGIN };
  assert.equal((await worker.fetch(post({ ...good, consent: false }), env, ctx)).status, 400);
  assert.equal((await worker.fetch(post({ ...good, phone: '12345' }), env, ctx)).status, 400);
  assert.equal((await worker.fetch(post(good, 'https://evil.example'), env, ctx)).status, 403);
  assert.equal([...env.CLICKS.m.keys()].filter((k) => k.startsWith('l:')).length, 0);
});

test('honeypot is accepted silently but nothing is stored', async () => {
  const env = { CLICKS: kv(), SITE_ORIGIN: ORIGIN };
  const res = await worker.fetch(post({ ...good, website: 'spam' }), env, ctx);
  assert.equal(res.status, 200);
  assert.equal([...env.CLICKS.m.keys()].filter((k) => k.startsWith('l:')).length, 0);
});

test('an IP is limited to 5 leads a day', async () => {
  const env = { CLICKS: kv(), SITE_ORIGIN: ORIGIN };
  for (let i = 0; i < 5; i++) assert.equal((await worker.fetch(post(good), env, ctx)).status, 200);
  assert.equal((await worker.fetch(post(good), env, ctx)).status, 429);
});

test('the leads list requires the stats token', async () => {
  const env = { CLICKS: kv(), SITE_ORIGIN: ORIGIN, STATS_TOKEN: 's3cret' };
  assert.equal((await worker.fetch(new Request('https://w.example/leads'), env, ctx)).status, 401);
  const ok = new Request('https://w.example/leads', { headers: { authorization: 'Bearer s3cret' } });
  assert.equal((await worker.fetch(ok, env, ctx)).status, 200);
});
