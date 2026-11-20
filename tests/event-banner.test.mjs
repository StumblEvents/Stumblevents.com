import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { resolveEventPreviewImageUrl, resolveShareFallbackImageUrl, shareImageMetadata } = require('../api/_share-preview-utils.js');
const { renderEventPreview } = require('../api/_event-preview.js');
const fallback = 'https://preview.example/assets/stumbl-wordmark.png?v=20261120';
const options = { supabaseUrl: 'https://project.supabase.co', serviceRoleKey: '', bucket: 'event-images', bannerImagePath: 'owner/event/flyer.jpg', fallbackImageUrl: fallback, visibility: 'public', context: 'test' };

test('public flyer is verified anonymously and used without a signing key or bucket override', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { headers: { 'Content-Type': 'image/jpeg' } });
  });
  const url = await resolveEventPreviewImageUrl(options);
  assert.equal(url, 'https://project.supabase.co/storage/v1/object/public/event-images/owner/event/flyer.jpg');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'HEAD');
  assert.equal(calls[0].init.headers, undefined);
});

test('missing, non-image, and unreachable public flyers fall back safely', async t => {
  for (const response of [new Response(null, { status: 404 }), new Response(null, { headers: { 'Content-Type': 'application/json' } }), null]) {
    t.mock.method(globalThis, 'fetch', async () => {
      if (!response) throw new Error('offline');
      return response;
    });
    assert.equal(await resolveEventPreviewImageUrl(options), fallback);
  }
});

test('private flyers without a signing key are neither probed nor exposed', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected private storage request'); });
  assert.equal(await resolveEventPreviewImageUrl({ ...options, visibility: 'private' }), fallback);
  assert.equal(fetch.mock.callCount(), 0);
});

test('a signing outage still permits the verified public flyer', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    if (init.method === 'POST') throw new Error('signing unavailable');
    return new Response(null, { headers: { 'Content-Type': 'image/jpeg' } });
  });
  assert.match(await resolveEventPreviewImageUrl({ ...options, serviceRoleKey: 'fixture-key' }), /\/object\/public\//);
});

test('legacy branded fallback overrides resolve to the current wordmark on Preview', () => {
  const original = process.env.EXPO_PUBLIC_SHARE_FALLBACK_IMAGE_URL;
  try {
    process.env.EXPO_PUBLIC_SHARE_FALLBACK_IMAGE_URL = 'https://www.stumblevents.com/stumbl-share-preview.jpg';
    assert.equal(resolveShareFallbackImageUrl('https://preview.example'), fallback);
  } finally {
    if (original === undefined) delete process.env.EXPO_PUBLIC_SHARE_FALLBACK_IMAGE_URL;
    else process.env.EXPO_PUBLIC_SHARE_FALLBACK_IMAGE_URL = original;
  }
});

test('hero uses the event image without cropping and recovers once on a browser image error', () => {
  const html = renderEventPreview({ preview: { id: 'event', title: 'Flyer <title>', visibility: 'public', banner_url: 'https://images.example/flyer.jpg', occurrences: [] }, canonicalUrl: 'https://preview.example/events/event' });
  assert.match(html, /class="hero-image" src="https:\/\/images.example\/flyer.jpg"/);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /Flyer &lt;title&gt; event banner/);
  const handler = html.match(/onerror="([^"]*)"/)[1];
  const image = { onerror: handler, src: 'broken', dataset: { fallback }, classList: { add(value) { this.value = value; } }, alt: 'event' };
  vm.runInNewContext(`(function(){${handler}}).call(image)`, { image });
  assert.equal(image.src, fallback);
  assert.equal(image.onerror, null);
  assert.equal(image.classList.value, 'is-fallback');
  assert.equal(image.alt, 'Stumbl');
});

test('bannerless events use the current official website wordmark and correct social dimensions', async () => {
  const html = renderEventPreview({ preview: { id: 'event', title: 'No banner', visibility: 'public', occurrences: [] }, canonicalUrl: 'https://preview.example/events/event' });
  assert.match(html, /class="hero-image is-fallback"/);
  assert.match(html, /\/assets\/stumbl-wordmark\.png\?v=20261120/);
  assert.doesNotMatch(html, /stumbl-share-preview\.(jpg|png)/);
  const png = await readFile('assets/stumbl-wordmark.png');
  const metadata = shareImageMetadata(fallback);
  assert.equal(metadata.width, png.readUInt32BE(16));
  assert.equal(metadata.height, png.readUInt32BE(20));
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  for (const ext of ['jpg', 'png']) assert(config.redirects.some(r => r.source === '/stumbl-share-preview.' + ext && r.destination.includes('/assets/stumbl-wordmark.png')));
});
