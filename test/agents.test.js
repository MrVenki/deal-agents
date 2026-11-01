import test from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../src/agents/compliance.js';
import { affiliateUrl, trackedUrl } from '../src/links.js';
import { pickNiche } from '../src/agents/strategist.js';
import { findDeal } from '../src/agents/dealFinder.js';

const cfg = {
  amazonTag: 'mytag-21',
  trackingIds: {},
  redirectBase: 'https://r.example.dev',
  limits: { maxPostChars: 900 },
  strategy: { explorePosts: 2, epsilon: 0 },
  niches: [
    { name: 'a', keywords: ['lock'] },
    { name: 'b', keywords: ['fan'] },
  ],
};
const goodUrl = 'https://www.amazon.in/dp/B012345678?tag=mytag-21';

test('amazon links are rebuilt with our tag only', () => {
  const url = affiliateUrl({ url: 'https://www.amazon.in/Some-Title/dp/B012345678/ref=x?tag=other-21&psc=1' }, cfg, 'a');
  assert.equal(url, goodUrl);
});

test('unknown stores without an affiliate url are skipped', () => {
  assert.equal(affiliateUrl({ url: 'https://example.com/p/1' }, cfg, 'a'), null);
});

test('compliance blocks prices and hype on amazon posts', () => {
  assert.ok(!check('Great lock at ₹4,999 today for everyone', goodUrl, cfg).ok);
  assert.ok(!check('Lowest price ever on this smart lock!', goodUrl, cfg).ok);
  assert.ok(!check('Read more at https://evil.example now please', goodUrl, cfg).ok);
  assert.ok(check('A fingerprint lock many new flat owners like.', goodUrl, cfg).ok);
});

test('strategist explores before exploiting', () => {
  const state = { niches: { a: { posts: 5, clicks: 50 }, b: { posts: 0, clicks: 0 } } };
  assert.equal(pickNiche(cfg, state), 'b');
  state.niches.b = { posts: 2, clicks: 1 };
  state.niches.a = { posts: 2, clicks: 20 };
  assert.equal(pickNiche(cfg, state, () => 0.9), 'a');
});

test('deal finder skips posted deals and wrong niches', () => {
  const deals = [
    { id: '1', title: 'Smart lock', url: 'https://www.amazon.in/dp/B012345678' },
    { id: '2', title: 'Ceiling fan', url: 'https://www.amazon.in/dp/B012345679' },
  ];
  assert.equal(findDeal(deals, { name: 'a' }, cfg, { posted: [] }).id, '1');
  assert.equal(findDeal(deals, { name: 'a' }, cfg, { posted: [{ dealId: '1' }] }), undefined);
});

test('tracked url wraps through the redirector', () => {
  const t = trackedUrl(goodUrl, cfg, 'a', 'p1');
  assert.ok(t.startsWith('https://r.example.dev/go?u='));
  const u = new URL(t).searchParams.get('u');
  assert.equal(Buffer.from(u, 'base64url').toString(), goodUrl);
});
