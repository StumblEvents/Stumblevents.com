import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import http from 'node:http';
import { createLocalPreviewServer } from '../scripts/local-preview.mjs';
import handler from '../api/event.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { renderEventPreview, eventStatus, fetchEventPreview } = require('../api/_event-preview.js');
const { downloadLinks, APP_STORE_URL } = require('../api/_app-downloads.js');
const { linkTargetFromRequest } = require('../api/_share-link-config.js');
const id = '123e4567-e89b-42d3-a456-426614174000';
const canonicalUrl = 'https://www.stumblevents.com/events/' + id;
const preview = { id, title: 'Public event', description: 'Community gathering', visibility: 'public', is_paid: false, start_time: '2030-12-19T19:00:00Z', timezone: 'America/Denver', creator: {} };

test('production downloads work without env vars and reject unverified store overrides', () => {
  const old = process.env.STUMBL_GOOGLE_PLAY_URL;
  process.env.STUMBL_GOOGLE_PLAY_URL = 'https://unverified.example/download';
  try {
    for (const ua of ['iPhone', 'iPad', 'Desktop']) assert.equal(downloadLinks(ua)[0].url, APP_STORE_URL);
    assert.deepEqual(downloadLinks('Android'), []);
    const html = renderEventPreview({ preview, canonicalUrl, userAgent: 'Android' });
    assert.match(html, /Android download is not available yet/);
    assert.doesNotMatch(html, /unverified.example/);
  } finally { if (old === undefined) delete process.env.STUMBL_GOOGLE_PLAY_URL; else process.env.STUMBL_GOOGLE_PLAY_URL = old; }
});

test('homepage and every event fallback include production downloads and return instructions', async () => {
  const homepage = await readFile('index.html', 'utf8');
  assert.equal(homepage.split(APP_STORE_URL).length - 1, 2);
  assert.match(homepage, /Stumbl is live on iOS/);
  assert.doesNotMatch(homepage, /href="https:\/\/play.google/);
  for (const event of [preview, null]) {
    const html = renderEventPreview({ preview: event, canonicalUrl, userAgent: 'iPhone' });
    assert.match(html, /app-store-badge.svg/);
    assert(html.includes(APP_STORE_URL));
    assert.match(html, /return to this page or your original message/);
    assert.doesNotMatch(html, /window.location|location.replace|http-equiv="refresh"|setTimeout/);
  }
});

test('event status uses future showings, end times, and explicit cancellation', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  assert.equal(eventStatus(preview, now), 'Upcoming');
  assert.equal(eventStatus({ ...preview, start_time: '2020-01-01T12:00:00Z' }, now), 'Past');
  assert.equal(eventStatus({ ...preview, start_time: '2026-11-23T11:00:00Z', end_time: '2026-11-23T13:00:00Z' }, now), 'Happening now');
  assert.equal(eventStatus({ ...preview, status: 'canceled' }, now), 'Canceled');
  assert.equal(eventStatus({ ...preview, start_time: '2020-01-01', occurrences: [{ start_at: '2030-01-01' }] }, now), 'Upcoming');
  assert.equal(eventStatus(null, now), 'Unavailable');
});

test('timezone, recurrence, share controls and canonical metadata render without an app', () => {
  const html = renderEventPreview({ preview: { ...preview, occurrences: [{ start_at: '2030-01-01' }, { start_at: '2030-02-01' }] }, canonicalUrl });
  for (const text of ['America/Denver', '2 scheduled showings', 'Share event', 'Open in Stumbl', 'Free admission', 'og:title', 'twitter:card']) assert(html.includes(text));
  assert(html.includes(`<link rel="canonical" href="${canonicalUrl}"`));
  assert.doesNotThrow(() => renderEventPreview({ preview: { ...preview, timezone: 'invalid/timezone' }, canonicalUrl }));
});

test('private social metadata contains no private title, description or banner', () => {
  const html = renderEventPreview({ preview: { ...preview, visibility: 'private', title: 'Secret title', description: 'Secret address', banner_url: 'https://example.com/private.jpg' }, canonicalUrl: canonicalUrl + '?invite=authorized', noindex: true });
  const head = html.split('</head>')[0];
  assert.match(head, /Private Stumbl invitation/);
  assert.doesNotMatch(head, /content="Secret|content="https:\/\/example.com\/private.jpg/);
  assert.match(head, /noindex,nofollow/);
  assert.match(html, /<h1>Secret title<\/h1>/);
});

test('public default never inherits a development deployment target', () => {
  const old = process.env.STUMBL_SHARE_LINK_TARGET;
  process.env.STUMBL_SHARE_LINK_TARGET = 'development';
  try {
    assert.equal(linkTargetFromRequest({ query: {} }).environment, 'production');
    assert.equal(linkTargetFromRequest({ query: { app: 'development' } }).environment, 'development');
  } finally { if (old === undefined) delete process.env.STUMBL_SHARE_LINK_TARGET; else process.env.STUMBL_SHARE_LINK_TARGET = old; }
});

test('lifecycle restrictions fail closed before banner resolution', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_ANON_KEY = 'test-only';
  let payload;
  try {
    for (const fields of [{ deleted_at: '2026-01-01' }, { removed_at: '2026-01-01' }, { blocked_at: '2026-01-01' }, { is_restricted: true }, { moderation_status: 'pending' }, { publication_status: 'draft' }, { visibility: 'private' }]) {
      payload = { ...preview, ...fields };
      assert.equal(await fetchEventPreview({ eventId: id, baseUrl: 'https://www.stumblevents.com' }), null);
    }
  } finally {
    for (const [key, value] of [['SUPABASE_URL', oldUrl], ['SUPABASE_ANON_KEY', oldKey]]) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('generated association files permit production iOS and gate Android signing', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'stumbl-launch-tests-'));
  const env = { ...process.env, APPLE_TEAM_ID: 'KKF26CHCH6', WELL_KNOWN_OUTPUT_DIR: output };
  for (const key of ['APPLE_DEV_TEAM_ID', 'ANDROID_APP_LINKS_VERIFIED', 'ANDROID_SHA256_CERT_FINGERPRINTS', 'ANDROID_DEV_SHA256_CERT_FINGERPRINTS']) delete env[key];
  const run = () => spawnSync(process.execPath, ['scripts/generate-well-known.mjs'], { env, encoding: 'utf8' });
  try {
    assert.equal(run().status, 0);
    const aasa = JSON.parse(await readFile(path.join(output, '.well-known/apple-app-site-association'), 'utf8'));
    const prod = aasa.applinks.details.find(row => row.appIDs.includes('KKF26CHCH6.com.stumbl.community'));
    assert(prod.components.some(row => row['/'] === '/events/*'));
    assert(prod.components.some(row => row['/'] === '/event/*'));
    const dev = aasa.applinks.details.find(row => row.appIDs.includes('KKF26CHCH6.com.stumbl.community.dev'));
    assert(dev.components.filter(row => ['/events/*', '/invite/*'].includes(row['/'])).every(row => row['?'].app === 'development'));
    assert.deepEqual(JSON.parse(await readFile(path.join(output, '.well-known/assetlinks.json'), 'utf8')), []);
    env.ANDROID_APP_LINKS_VERIFIED = 'true'; env.ANDROID_SHA256_CERT_FINGERPRINTS = 'invalid';
    assert.notEqual(run().status, 0);
    env.ANDROID_SHA256_CERT_FINGERPRINTS = Array(32).fill('AB').join(':'); // synthetic test fixture, never a production certificate
    assert.equal(run().status, 0);
    const links = JSON.parse(await readFile(path.join(output, '.well-known/assetlinks.json'), 'utf8'));
    assert.deepEqual(links.map(row => row.target.package_name), ['com.stumbl.community']);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('share uses native share, clipboard and selection fallback without navigation', async () => {
  const source = await readFile('event-page.js', 'utf8');
  for (const mode of ['native', 'clipboard', 'fallback', 'error', 'cancel']) {
    let click, shared, copied, selected = false;
    const input = { value: canonicalUrl, focus() {}, select() { selected = true; } };
    const note = { textContent: '' };
    const button = { addEventListener(_, fn) { click = fn; } };
    const navigator = mode === 'native' ? { share: async value => { shared = value; } }
      : mode === 'clipboard' ? { clipboard: { writeText: async value => { copied = value; } } }
      : mode === 'error' || mode === 'cancel' ? { share: async () => { const error = new Error(); error.name = mode === 'cancel' ? 'AbortError' : 'Error'; throw error; } } : {};
    vm.runInNewContext(source, { navigator, window: { isSecureContext: true }, document: { getElementById: key => ({ 'share-event': button, 'event-link': input, 'share-note': note })[key] } });
    await click();
    if (mode === 'native') assert.equal(shared.url, canonicalUrl);
    if (mode === 'clipboard') assert.equal(copied, canonicalUrl);
    if (mode === 'fallback' || mode === 'error') assert.equal(selected, true);
    if (mode === 'cancel') assert.equal(note.textContent, '');
  }
});

test('malformed event IDs return a safe 404 without a backend lookup', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not query invalid IDs'); });
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = body; } };
  await handler({ query: { id: 'not-an-event' }, headers: { host: 'www.stumblevents.com' } }, res);
  assert.equal(res.statusCode, 404);
  assert.match(res.body, /Event unavailable/);
  assert.match(res.body, /noindex,nofollow/);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('download assets and share script are served with working local MIME types', async t => {
  const server = createLocalPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function get(url) {
    return new Promise((resolve, reject) => http.get(`http://127.0.0.1:${server.address().port}${url}`, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', data => { body += data; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    }).on('error', reject));
  }
  const home = await get('/'); assert.equal(home.status, 200); assert(home.body.includes(APP_STORE_URL));
  for (const [url, type] of [['/assets/app-store-badge.svg', 'image/svg+xml'], ['/assets/google-play-badge.png', 'image/png'], ['/event-page.js', 'text/javascript']]) {
    const result = await get(url); assert.equal(result.status, 200); assert(result.type.startsWith(type));
  }
});
