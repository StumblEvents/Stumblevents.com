import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const eventId = '123e4567-e89b-42d3-a456-426614174000';
const inviteToken = 'private-token_123';
const require = createRequire(import.meta.url);
const { configuredBaseUrl } = require('../api/_share-link-config.js');
const { resolveEventPreviewImageUrl } = require('../api/_share-preview-utils.js');
const linkPreview = require('../api/_event-page.js');
const invitePreview = require('../api/invite.js');
const calendar = require('../api/calendar.js');
process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://stumblevents.com';
assert.equal(configuredBaseUrl({ headers: { host: 'www.stumblevents.com', 'x-forwarded-proto': 'https' } }), 'https://www.stumblevents.com', 'browser previews retain the www host after the native shared apex link redirects');
process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://www.stumblevents.com';
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.example';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.STUMBL_APP_STORE_URL = 'https://store.example.test/stumbl-ios';
process.env.STUMBL_GOOGLE_PLAY_URL = 'https://store.example.test/stumbl-android';

const previousFetchForSignedImage = globalThis.fetch;
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ signedURL: '/storage/v1/object/sign/event-images/creator%2Fevent%2Fbanner.jpg?token=opaque' }) });
const signedBanner = await resolveEventPreviewImageUrl({
  supabaseUrl: 'https://project.supabase.co', serviceRoleKey: 'server-only-key', bucket: 'event-images', bannerImagePath: 'creator/event/banner.jpg', fallbackImageUrl: 'https://www.stumblevents.com/stumbl-share-preview.jpg', context: 'test',
});
globalThis.fetch = previousFetchForSignedImage;
assert.equal(signedBanner, 'https://project.supabase.co/storage/v1/object/sign/event-images/creator%2Fevent%2Fbanner.jpg?token=opaque', 'private event banners use a crawler-readable signed HTTPS URL');
const fallbackForPrivateBanner = await resolveEventPreviewImageUrl({
  supabaseUrl: 'https://project.supabase.co', serviceRoleKey: '', bucket: 'event-images', bannerImagePath: 'creator/event/banner.jpg', fallbackImageUrl: 'https://www.stumblevents.com/stumbl-share-preview.jpg', context: 'test',
});
assert.equal(fallbackForPrivateBanner, 'https://www.stumblevents.com/stumbl-share-preview.jpg', 'a missing server signing key falls back instead of publishing an unreadable private-storage URL');

const publicEvent = {
  id: eventId, visibility: 'public', title: 'Neighborhood Festival', description: 'Food, music, and local makers.',
  start_time: '2026-10-10T23:00:00Z', end_time: '2026-10-11T01:00:00Z', timezone: 'America/Denver',
  category_name: 'Party', subcategory_name: 'Community', custom_category_label: 'Family friendly', display_pills: ['category', 'subcategory', 'custom'],
  venue_name: 'Pioneer Park', address: '100 Main St', city: 'Provo', state: 'UT', zip: '84601', latitude: 40.2338, longitude: -111.6585,
  parking_notes: 'Free parking is available on the north side.', is_paid: true, ticket_sales_enabled: true,
  creator: { display_name: 'Stumbl Events', is_verified: true },
  occurrences: [{ id: 'first', title: 'Opening night', start_at: '2026-10-10T23:00:00Z', end_at: '2026-10-11T01:00:00Z' }, { id: 'second', title: 'Second showing', start_at: '2026-10-17T23:00:00Z', end_at: '2026-10-18T01:00:00Z' }],
  schedule_items: [{ id: 'activity', title: 'Live music', start_at: '2026-10-10T23:30:00Z', end_at: '2026-10-11T00:30:00Z', description: 'Main stage.' }],
  ticket_types: [{ id: 'ticket', name: 'General admission', description: 'Entry for one.', price_cents: 500, currency: 'usd' }],
};

async function render(handler, query, event = publicEvent, userAgent = 'Mozilla/5.0 (iPhone)', { cookie = '', host = 'www.stumblevents.com' } = {}) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => event });
  const response = { statusCode: 0, headers: {}, body: '', setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(body) { this.body = body; } };
  try { await handler({ query, headers: { host, 'x-forwarded-proto': 'https', 'user-agent': userAgent, cookie } }, response); } finally { globalThis.fetch = previousFetch; }
  return response;
}

function firstCookie(header) {
  const value = Array.isArray(header) ? header[0] : header;
  return String(value || '').split(';')[0];
}

const publicPreview = await render(linkPreview, { type: 'event', id: eventId });
assert.equal(publicPreview.statusCode, 200);
for (const detail of ['Neighborhood Festival', 'Food, music, and local makers.', 'Pioneer Park', 'Free parking is available', 'Live music', 'Stumbl Events', 'Verified', 'About this event', 'Location details', 'Get Directions', 'Save to Calendar', 'Calendar Interest', 'Download Stumbl']) assert.equal(publicPreview.body.includes(detail), true, `public preview renders ${detail}`);
assert.equal(publicPreview.body.includes('Good to know'), false, 'preview does not invent an extra information section');
assert.equal(publicPreview.body.includes('General admission'), false, 'ticket inventory is not exposed as an unnecessary preview section');
assert.equal(publicPreview.body.includes('https://apps.apple.com/us/app/stumbl-events/id6792025434'), true, 'iOS receives the verified production store CTA');
assert.equal(publicPreview.body.includes('stumbl://'), false, 'browser preview never redirects to a custom URL scheme');
assert.match(publicPreview.body, /property="og:title" content="Neighborhood Festival"/, 'server HTML includes the event title for crawlers');
assert.match(publicPreview.body, /property="og:description" content="Sat, Oct 10, 5:00 PM – Oct 10, 7:00 PM · Food, music, and local makers\."/, 'server HTML includes date/time and a concise description for crawlers');
assert.match(publicPreview.body, /property="og:type" content="website"/, 'server HTML marks the preview as a website');
assert.match(publicPreview.body, /property="og:site_name" content="Stumbl"/, 'server HTML identifies Stumbl as the site');
assert.match(publicPreview.body, /name="twitter:card" content="summary_large_image"/, 'server HTML requests a large social image card');
assert.match(publicPreview.body, /property="og:image" content="https:\/\/www\.stumblevents\.com\/assets\/stumbl-wordmark\.png\?v=20261120"/, 'events without a usable banner receive the branded absolute HTTPS fallback');
assert.match(publicPreview.body, /property="og:image:type" content="image\/png"/, 'server HTML declares the fallback image MIME type');
assert.equal(publicPreview.body.includes(`href="https://stumblevents.com/events/${eventId}"`), true, 'explicit app handoff uses the alternate associated host');
assert.equal(publicPreview.headers['cache-control'], 'private, no-store');
assert.equal(publicPreview.headers['referrer-policy'], 'same-origin', 'preview does not leak invitation URLs as external referrers');
assert.match(String(publicPreview.headers['set-cookie']), /stumbl_calendar_interest=/, 'first-party preview seeds the calendar-interest identifier before a download');
assert.match(String(publicPreview.headers['set-cookie']), /Domain=stumblevents\.com/, 'apex and www share the production first-party identifier');
assert.match(String(publicPreview.headers['set-cookie']), /HttpOnly; Secure; SameSite=Lax/, 'the anonymous identifier stays inaccessible to page JavaScript and scoped to first-party navigation');
const browserCookie = firstCookie(publicPreview.headers['set-cookie']);

const refreshedPreview = await render(linkPreview, { type: 'event', id: eventId }, publicEvent, 'Mozilla/5.0 (iPhone)', { cookie: browserCookie, host: 'stumblevents.com' });
assert.equal(refreshedPreview.headers['set-cookie'], undefined, 'a refresh on the alternate production host reuses the existing visitor identifier');

const classificationAndAddressPreview = await render(linkPreview, { type: 'event', id: eventId }, {
  ...publicEvent,
  category_name: 'category',
  subcategory_name: 'subcategory',
  custom_category_label: 'Family friendly', display_pills: ['custom', 'custom', 'Display pills', ''],
  address: '123 Main St, West Jordan, UT 84088', city: 'West Jordan', state: 'UT', zip: '84088',
});
assert.equal(classificationAndAddressPreview.body.includes('>subcategory<'), false, 'placeholder classification values are never rendered as category pills');
assert.equal(classificationAndAddressPreview.body.includes('>category<'), false, 'raw category field placeholders are never rendered as category pills');
assert.equal((classificationAndAddressPreview.body.match(/Family friendly/g) || []).length, 1, 'duplicate display pills collapse to the native-popup equivalent');
assert.equal((classificationAndAddressPreview.body.match(/West Jordan, UT 84088/g) || []).length, 1, 'an address that already contains its locality does not repeat city, state, or postal code');

const privatePreview = await render(linkPreview, { type: 'event', id: eventId, invite: inviteToken }, { ...publicEvent, visibility: 'private', id: eventId });
assert.equal(privatePreview.statusCode, 200);
assert.equal(privatePreview.body.includes('noindex,nofollow'), true, 'valid private previews are not indexable');
assert.equal(privatePreview.body.includes(`invite=${inviteToken}`), true, 'the handoff preserves the invitation token');

const privateInvitePreview = await render(invitePreview, { token: inviteToken }, { ...publicEvent, visibility: 'private', id: eventId });
assert.match(privateInvitePreview.body, new RegExp(`property="og:url" content="https:\/\/www\\.stumblevents\\.com\/invite\/${inviteToken}"`), 'the shorter invitation route is preserved as the canonical preview URL');
assert.match(privateInvitePreview.body, new RegExp(`name="invite" value="${inviteToken}"`), 'the shorter invitation route keeps its token only in first-party calendar actions');

const inviteRoute = await render(invitePreview, { token: inviteToken }, { ...publicEvent, visibility: 'private', id: eventId });
assert.equal(inviteRoute.statusCode, 200);
assert.equal(inviteRoute.body.includes('Neighborhood Festival'), true, 'token-only private invitation resolves its event');

const unavailable = await render(linkPreview, { type: 'event', id: eventId, invite: inviteToken }, null);
assert.equal(unavailable.statusCode, 404, 'expired, revoked, or unauthorized invite responses do not reveal an event');
assert.equal(unavailable.body.includes('Neighborhood Festival'), false, 'unauthorized private responses contain no presentation data');

const desktopPreview = await render(linkPreview, { type: 'event', id: eventId }, publicEvent, 'Mozilla/5.0 (X11; Linux x86_64)');
assert.equal(desktopPreview.body.includes('Download on the App Store'), true, 'desktop shows the configured App Store option');
assert.equal(desktopPreview.body.includes('Get it on Google Play'), false, 'desktop hides the unverified Play option');

async function calendarResponse(query, event = publicEvent, cookie = '', host = 'www.stumblevents.com') {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).includes('get_event_web_preview')) return { ok: true, status: 200, json: async () => event };
    if (String(url).includes('track_web_calendar_interest')) return { ok: true, status: 200, json: async () => true };
    throw new Error(`Unexpected fetch ${url}`);
  };
  const response = { statusCode: 0, headers: {}, body: '', setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(body = '') { this.body = body; } };
  try { await calendar({ query, headers: { host, 'x-forwarded-proto': 'https', cookie } }, response); } finally { globalThis.fetch = previousFetch; }
  return { response, calls };
}

const ics = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'ics' });
assert.equal(ics.response.statusCode, 200, 'calendar .ics is available without an account');
assert.match(ics.response.headers['content-type'], /^text\/calendar/, 'calendar endpoint returns an iCalendar document');
assert.match(ics.response.body, /SUMMARY:Opening night/, 'calendar file uses the selected showing title');
assert.match(ics.response.body, /DTSTART:20261010T230000Z/, 'calendar file keeps the authoritative occurrence time');
assert.match(ics.response.body, /LOCATION:Pioneer Park\\, 100 Main St/, 'calendar file carries the event location');
assert.equal(ics.calls.filter((call) => String(call.url).includes('track_web_calendar_interest')).length, 1, 'opening a calendar option records one separate calendar-interest event');
assert.equal(ics.response.headers['set-cookie'].includes('HttpOnly'), true, 'calendar dedupe identifier is not readable by browser JavaScript');

const repeatedIcs = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'ics' }, publicEvent, browserCookie);
const repeatedGoogleForSameShowing = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'google' }, publicEvent, browserCookie, 'stumblevents.com');
const repeatedOutlookForSameShowing = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'outlook' }, publicEvent, browserCookie);
const repeatedGoogleAgain = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'google' }, publicEvent, browserCookie);
const repeatedIcsAgain = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'ics' }, publicEvent, browserCookie, 'stumblevents.com');
const firstTracking = JSON.parse(repeatedIcs.calls.find((call) => String(call.url).includes('track_web_calendar_interest')).options.body).p_tracking_id;
const googleTracking = JSON.parse(repeatedGoogleForSameShowing.calls.find((call) => String(call.url).includes('track_web_calendar_interest')).options.body).p_tracking_id;
const repeatedTrackingIds = [repeatedOutlookForSameShowing, repeatedGoogleAgain, repeatedIcsAgain].map(({ calls }) => JSON.parse(calls.find((call) => String(call.url).includes('track_web_calendar_interest')).options.body).p_tracking_id);
assert.deepEqual([firstTracking, googleTracking, ...repeatedTrackingIds], Array(5).fill(firstTracking), 'five calendar actions for one browser and showing use one dedupe ID');
assert.equal(repeatedIcs.response.headers['set-cookie'], undefined, 'calendar downloads reuse the page-seeded cookie instead of rotating it');

const secondShowing = await calendarResponse({ event: eventId, occurrence: 'second', provider: 'ics' }, publicEvent, browserCookie);
const secondShowingPayload = JSON.parse(secondShowing.calls.find((call) => String(call.url).includes('track_web_calendar_interest')).options.body);
assert.equal(secondShowingPayload.p_tracking_id, firstTracking, 'the browser keeps one anonymous ID across showings');
assert.equal(secondShowingPayload.p_instance_id, 'second', 'different showings retain independent Calendar Interest records');

const missingShowing = await calendarResponse({ event: eventId, provider: 'ics' });
assert.equal(missingShowing.response.statusCode, 404, 'multi-showing events require an explicit occurrence selection');

const google = await calendarResponse({ event: eventId, occurrence: 'second', provider: 'google' });
assert.equal(google.response.statusCode, 302, 'Google Calendar starts via a provider redirect');
assert.match(google.response.headers.location, /^https:\/\/calendar\.google\.com\//, 'Google redirect uses the official calendar endpoint');

const privateCalendar = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'ics', invite: inviteToken }, { ...publicEvent, visibility: 'private' });
assert.equal(privateCalendar.response.statusCode, 200, 'a valid private invitation can save its selected showing');
assert.equal(privateCalendar.response.body.includes(inviteToken), false, 'private invitation tokens are never copied into downloadable calendar files');
const privateAnalytics = privateCalendar.calls.find((call) => String(call.url).includes('track_web_calendar_interest'));
assert.equal(JSON.parse(privateAnalytics.options.body).p_invite_token, inviteToken, 'the server-only analytics RPC revalidates the private invitation token');

const privateGoogle = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'google', invite: inviteToken }, { ...publicEvent, visibility: 'private' });
assert.equal(privateGoogle.response.headers.location.includes(inviteToken), false, 'private invitation tokens are never sent to external calendar providers');

const repeatedPrivateCalendar = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'outlook', invite: inviteToken }, { ...publicEvent, visibility: 'private' }, browserCookie);
const repeatedPrivatePayload = JSON.parse(repeatedPrivateCalendar.calls.find((call) => String(call.url).includes('track_web_calendar_interest')).options.body);
assert.equal(repeatedPrivatePayload.p_tracking_id, firstTracking, 'private invitation downloads use the same opaque first-party ID without putting it in URLs');

const malformedCookie = await calendarResponse({ event: eventId, occurrence: 'first', provider: 'ics' }, publicEvent, 'stumbl_calendar_interest=%E0%A4%A');
assert.match(String(malformedCookie.response.headers['set-cookie']), /stumbl_calendar_interest=/, 'unavailable or malformed browser storage degrades safely to a new anonymous ID');

const sparsePreview = await render(linkPreview, { type: 'event', id: eventId }, {
  id: eventId, visibility: 'public', title: 'Minimal event', start_time: '2026-10-10T23:00:00Z', timezone: 'America/Denver', occurrences: [], schedule_items: [], display_pills: [], creator: {},
});
assert.equal(sparsePreview.statusCode, 200, 'missing optional presentation fields do not prevent a public preview');
assert.equal(sparsePreview.body.includes('Minimal event'), true, 'sparse preview still renders the event title');


console.log('Recovered website event-sharing tests passed');
