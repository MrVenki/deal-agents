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
  assert.equal(findDeal(deals, { name: 'a' }, cfg, { posted: [{ dealId: '1', date: new Date().toISOString().slice(0, 10) }] }), undefined);
});

test('tracked url wraps through the redirector with niche, product and source', () => {
  const t = new URL(trackedUrl(goodUrl, cfg, 'a', 'prod-1', 'site'));
  assert.equal(t.origin + t.pathname, 'https://r.example.dev/go');
  assert.equal(Buffer.from(t.searchParams.get('u'), 'base64url').toString(), goodUrl);
  assert.deepEqual([t.searchParams.get('n'), t.searchParams.get('p'), t.searchParams.get('s')], ['a', 'prod-1', 'site']);
});

test('flipkart links pass through, other hosts are rejected', () => {
  const fk = 'https://www.flipkart.com/some-item/p/itm123';
  assert.equal(affiliateUrl({ url: fk }, cfg, 'a'), fk);
  assert.equal(affiliateUrl({ url: 'https://evil.example/dp/B012345678' }, cfg, 'a'), null);
});

test('catalog products match by niche and respect the repost cooldown', () => {
  const c = { ...cfg, limits: { ...cfg.limits, repostAfterDays: 14 } };
  const deals = [{ id: 'x', niche: 'b', title: 'Anything', url: 'https://www.amazon.in/dp/B012345678' }];
  assert.equal(findDeal(deals, { name: 'a' }, c, { posted: [] }), undefined);
  const now = Date.parse('2026-11-20');
  const posted = (date) => ({ posted: [{ dealId: 'x', date }] });
  assert.equal(findDeal(deals, { name: 'b' }, c, posted('2026-11-10'), now), undefined);
  assert.equal(findDeal(deals, { name: 'b' }, c, posted('2026-10-01'), now)?.id, 'x');
});
