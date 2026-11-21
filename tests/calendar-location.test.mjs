import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { calendarLocation } = require('../api/_calendar-location.js');
const calendar = require('../api/calendar.js');

const cases = [
  [{ address: '234 N Ashford Dr, North Salt Lake, UT 84054, United States', city: 'North Salt Lake', state: 'UT', zip: '84054' }, '234 N Ashford Dr, North Salt Lake, UT 84054, United States'],
  [{ address: '17 Main Street', city: 'Portland', state: 'ME', zip: '04101', country: 'United States' }, '17 Main Street, Portland, ME 04101, United States'],
  [{ address: '17 Main Street, Portland', city: 'Portland', state: 'ME', zip: '04101' }, '17 Main Street, Portland, ME 04101'],
  [{ address: '17 Main Street, Portland, ME', city: 'Portland', state: 'ME', zip: '04101' }, '17 Main Street, Portland, ME 04101'],
  [{ address: '17 Main Street, United States', city: 'Portland', state: 'ME', zip: '04101', country: 'United States' }, '17 Main Street, Portland, ME 04101, United States'],
  [{ city: 'Ottawa', state: 'ON', zip: 'K1A 0A9', country: 'Canada' }, 'Ottawa, ON K1A 0A9, Canada'],
  [{ address: '17 Utah Street', state: 'UT' }, '17 Utah Street, UT'],
  [{ address: ' 17 Main Street , Portland, ME 04101 ', city: 'portland', state: 'me', zip: '04101' }, '17 Main Street, Portland, ME 04101'],
  [{ venue_name: 'City Hall', address: 'City Hall, 17 Main Street' }, 'City Hall, 17 Main Street'],
  [{ venue_name: 'City Hall' }, 'City Hall'],
  [{}, ''],
];

test('complete, partial, structured, international, and missing calendar addresses normalize without duplication', () => {
  for (const [input, expected] of cases) assert.equal(calendarLocation(input), expected);
});

test('ICS, Google, and Outlook use the same normalized location without changing coordinates', async t => {
  const original = { ...process.env };
  process.env.SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_ANON_KEY = 'fixture';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_KEY;
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });
  for (const [location, expected] of cases) {
    const event = { ...location, id: 'event', title: 'Calendar event', visibility: 'public', start_time: '2026-12-19T19:00:00Z', end_time: '2026-12-19T21:00:00Z', latitude: 40, longitude: -111 };
    t.mock.method(globalThis, 'fetch', async () => Response.json(event));
    for (const provider of ['ics', 'google', 'outlook']) {
      const res = { headers: {}, setHeader(k,v) { this.headers[k.toLowerCase()] = v; }, end(body = '') { this.body = body; } };
      await calendar({ query: { event: 'event', provider }, headers: { host: 'www.stumblevents.com' } }, res);
      if (provider === 'ics') {
        assert.equal(res.statusCode, 200);
        const actual = res.body.match(/(?:^|\r\n)LOCATION:([^\r]*)/)[1].replace(/\\,/g, ',');
        assert.equal(actual, expected);
      } else {
        assert.equal(res.statusCode, 302);
        assert.equal(new URL(res.headers.location).searchParams.get('location'), expected);
      }
    }
    assert.equal(event.latitude, 40);
    assert.equal(event.longitude, -111);
  }
});
