const APP_NAME = 'Stumbl';
const EVENT_IMAGE_BUCKET = 'event-images';
const { eventPillLabels } = require('./_event-pills');
const { resolveEventPreviewImageUrl, resolveShareFallbackImageUrl, shareImageMetadata } = require('./_share-preview-utils');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function supabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };
}

function validTimezone(value) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value || 'America/Denver' }); return value || 'America/Denver'; }
  catch { return 'UTC'; }
}

function eventStatus(preview, now = Date.now()) {
  if (!preview) return 'Unavailable';
  if (preview.is_canceled || preview.cancelled_at || preview.canceled_at || ['canceled', 'cancelled'].includes(preview.status)) return 'Canceled';
  const rows = calendarOccurrences(preview);
  if (!rows.length) return 'Schedule to be announced';
  const times = rows.map(row => ({ start: Date.parse(row.start_at), end: Date.parse(row.end_at || row.start_at) }));
  if (times.some(row => row.start <= now && row.end >= now)) return 'Happening now';
  if (times.some(row => row.start > now || row.end > now)) return 'Upcoming';
  return times.every(row => Number.isFinite(row.end) && row.end < now) ? 'Past' : 'Schedule to be announced';
}

function formatDateTime(value, timezone, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: validTimezone(timezone),
    weekday: options.withWeekday === false ? undefined : 'short', month: 'short', day: 'numeric',
    ...(options.time === false ? {} : { hour: 'numeric', minute: '2-digit' }),
  }).format(date);
}

function formatRange(startAt, endAt, timezone) {
  const start = formatDateTime(startAt, timezone);
  if (!endAt) return start;
  const end = formatDateTime(endAt, timezone, { withWeekday: false });
  return start && end ? `${start} – ${end}` : start || end;
}

function shareDescription(preview) {
  const when = formatRange(preview?.start_time, preview?.end_time, preview?.timezone);
  const detail = String(preview?.description || '').replace(/\s+/g, ' ').trim();
  // Keep the description compact enough for mobile link cards while always
  // leading with the date/time people need to decide whether to attend.
  const conciseDetail = detail.length > 180 ? `${detail.slice(0, 177).trimEnd()}…` : detail;
  return [when, conciseDetail].filter(Boolean).join(' · ') || 'Discover local events with Stumbl.';
}

function formatPrice(preview) {
  if (preview.is_paid === false) return 'Free admission';
  if (preview.is_paid !== true) return 'Attendance details in Stumbl';
  return 'Paid admission';
}

function cleanLocationPart(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/^\s*,|,\s*$/g, '').trim();
}

function addressIncludesPart(address, part) {
  const normalizedAddress = cleanLocationPart(address).toLocaleLowerCase();
  const normalizedPart = cleanLocationPart(part).toLocaleLowerCase();
  return !!normalizedPart && normalizedAddress.includes(normalizedPart);
}

function appendUniqueLocationPart(parts, value) {
  const clean = cleanLocationPart(value);
  if (!clean || parts.some((part) => part.toLocaleLowerCase() === clean.toLocaleLowerCase())) return;
  parts.push(clean);
}

function addressLabel(preview) {
  const venue = cleanLocationPart(preview?.venue_name);
  const address = cleanLocationPart(preview?.address);
  const city = cleanLocationPart(preview?.city);
  const state = cleanLocationPart(preview?.state);
  const zip = cleanLocationPart(preview?.zip);
  const parts = [];
  appendUniqueLocationPart(parts, venue);
  appendUniqueLocationPart(parts, address);
  // Addresses often already include their city, state, and postal code. Add
  // each field only when it is absent, avoiding a repeated locality line.
  if (!addressIncludesPart(address, city)) appendUniqueLocationPart(parts, city);
  if (!addressIncludesPart(address, state)) appendUniqueLocationPart(parts, state);
  if (!addressIncludesPart(address, zip)) appendUniqueLocationPart(parts, zip);
  return parts.join(', ');
}

function directionsUrl(preview) {
  if (preview.latitude != null && preview.latitude !== '' && preview.longitude != null && preview.longitude !== '' && Number.isFinite(Number(preview.latitude)) && Number.isFinite(Number(preview.longitude))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${preview.latitude},${preview.longitude}`)}`;
  }
  const address = addressLabel(preview);
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
}

function appHandoffUrl(canonicalUrl) {
  try {
    const parsed = new URL(canonicalUrl);
    if (parsed.hostname === 'www.stumblevents.com') parsed.hostname = 'stumblevents.com';
    return parsed.toString();
  } catch {
    return canonicalUrl;
  }
}

function calendarApiUrl(canonicalUrl) {
  try { return new URL('/api/calendar', canonicalUrl).toString(); } catch { return '/api/calendar'; }
}

function mapEmbedUrl(preview) {
  if (preview?.latitude == null || preview.latitude === '' || preview?.longitude == null || preview.longitude === '') return '';
  const latitude = Number(preview?.latitude);
  const longitude = Number(preview?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  const delta = 0.008;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function calendarOccurrences(preview) {
  const rows = Array.isArray(preview?.occurrences) ? preview.occurrences : [];
  const valid = rows.filter((row) => row?.start_at);
  if (valid.length) return valid;
  return preview?.start_time ? [{ id: '', start_at: preview.start_time, end_at: preview.end_time || null, title: preview.title || '' }] : [];
}

function siteOrigin(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

function invitationTokenFromCanonicalUrl(canonicalUrl) {
  try {
    const parsed = new URL(canonicalUrl);
    const queryToken = parsed.searchParams.get('invite') || parsed.searchParams.get('token') || parsed.searchParams.get('invite_token');
    if (queryToken) return queryToken;
    const [route, token] = parsed.pathname.split('/').filter(Boolean);
    return route === 'invite' ? token || '' : '';
  } catch {
    return '';
  }
}

async function fetchEventPreview({ eventId, inviteToken, baseUrl }) {
  const { url, anonKey, serviceRoleKey } = supabaseConfig();
  if (!url || !anonKey) throw new Error('Supabase public configuration is missing.');
  const response = await fetch(`${url}/rest/v1/rpc/get_event_web_preview`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ p_event_id: eventId || null, p_invite_token: inviteToken || null }),
  });
  if (!response.ok) throw new Error(`Supabase event preview lookup failed with HTTP ${response.status}.`);
  const body = await response.json();
  const preview = Array.isArray(body) ? body[0] : body;
  if (!preview || !(preview.id || preview.event_id)) return null;
  const normalized = { ...preview, id: preview.id || preview.event_id };
  // Keep the website's existing ID/invite boundary in addition to RPC checks.
  if (eventId && String(normalized.id).toLowerCase() !== String(eventId).toLowerCase()) return null;
  if (!['public', 'private'].includes(normalized.visibility)) return null;
  if (normalized.visibility === 'private' && !inviteToken) return null;
  // Defense in depth if a newer RPC returns lifecycle fields.
  if (normalized.deleted_at || normalized.removed_at || normalized.blocked_at || normalized.is_restricted === true) return null;
  if (normalized.moderation_status != null && normalized.moderation_status !== 'approved') return null;
  if (normalized.publication_status != null && normalized.publication_status !== 'published') return null;
  normalized.banner_url = await resolveEventPreviewImageUrl({
    supabaseUrl: url, serviceRoleKey, bucket: EVENT_IMAGE_BUCKET,
    bannerImagePath: normalized.banner_image_path, imageUrl: normalized.image_url,
    fallbackImageUrl: resolveShareFallbackImageUrl(baseUrl), context: normalized.visibility === 'private' ? 'private-event-preview' : 'public-event-preview',
    visibility: normalized.visibility,
  });
  return normalized;
}

const { downloadLinks } = require('./_app-downloads');

function genuineClassificationValues(values) {
  const placeholders = new Set(['category', 'subcategory', 'sub category', 'sub-subcategory', 'sub subcategory', 'display pill', 'display pills', 'unknown', 'none', 'n/a', 'null', 'undefined']);
  const seen = new Set();
  return (Array.isArray(values) ? values : []).reduce((result, value) => {
    if (typeof value !== 'string') return result;
    const clean = value.replace(/\s+/g, ' ').trim();
    const key = clean.toLocaleLowerCase();
    if (!clean || placeholders.has(key) || seen.has(key)) return result;
    seen.add(key);
    result.push(clean);
    return result;
  }, []);
}

function chips(values) {
  return values.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('');
}

function renderEventPreview({ preview = null, canonicalUrl, noindex = false, userAgent = '' }) {
  noindex = noindex || !preview || preview.visibility === 'private';
  const unavailable = !preview;
  const title = unavailable ? 'Event unavailable' : preview.title;
  const description = unavailable ? 'This event is unavailable or this invitation has expired.' : preview.description || '';
  const socialDescription = unavailable ? description : shareDescription(preview);
  const fallbackImage = resolveShareFallbackImageUrl(siteOrigin(canonicalUrl)) || '/assets/stumbl-wordmark.png?v=20261120';
  const image = preview?.banner_url || fallbackImage;
  const imageMeta = shareImageMetadata(image);
  const creator = preview?.creator || {};
  const categories = preview ? eventPillLabels(preview) : [];
  const handoff = appHandoffUrl(canonicalUrl);
  const maps = preview ? directionsUrl(preview) : '';
  const mapEmbed = preview ? mapEmbedUrl(preview) : '';
  const links = downloadLinks(userAgent);
  const occurrences = calendarOccurrences(preview);
  const activities = Array.isArray(preview?.schedule_items) ? preview.schedule_items : [];
  const safeTitle = escapeHtml(title || APP_NAME); const safeDescription = escapeHtml(description || 'Discover local events with Stumbl.'); const safeSocialDescription = escapeHtml(socialDescription);
  const privatePreview = preview?.visibility === 'private';
  const socialTitle = privatePreview ? 'Private Stumbl invitation' : safeTitle;
  const socialText = privatePreview ? 'Open this invitation to view the event in Stumbl.' : safeSocialDescription;
  const safeCanonical = escapeHtml(canonicalUrl); const safeHandoff = escapeHtml(handoff); const safeImage = escapeHtml(imageMeta?.url || '');
  const heroImage = `<img class="hero-image${image === fallbackImage ? ' is-fallback' : ''}" src="${safeImage || escapeHtml(fallbackImage)}" data-fallback="${escapeHtml(fallbackImage)}" alt="${image === fallbackImage ? 'Stumbl' : `${safeTitle} event banner`}" referrerpolicy="same-origin" onerror="this.onerror=null;this.src=this.dataset.fallback;this.classList.add('is-fallback');this.alt='Stumbl'" />`;
  const socialImageMeta = privatePreview ? shareImageMetadata(fallbackImage) : imageMeta;
  const socialImage = escapeHtml(socialImageMeta?.url || '');
  const calendarAction = escapeHtml(calendarApiUrl(canonicalUrl));
  const privateToken = invitationTokenFromCanonicalUrl(canonicalUrl);
  const occurrenceOptions = occurrences.map((occurrence, index) => `<option value="${escapeHtml(occurrence.id || '')}">${escapeHtml(`${occurrence.title || (occurrences.length > 1 ? `Showing ${index + 1}` : title)} — ${formatRange(occurrence.start_at, occurrence.end_at, preview.timezone)}`)}</option>`).join('');
  const activityMarkup = activities.length ? `<div class="activities"><strong>Schedule</strong>${activities.slice(0, 20).map((item) => `<div>${escapeHtml(item.title)}${item.start_at ? `<span>${escapeHtml(formatRange(item.start_at, item.end_at, preview.timezone))}</span>` : ''}</div>`).join('')}</div>` : '';
  const storeButtons = links.map((link) => `<a class="store" style="flex-wrap:wrap;gap:12px" href="${escapeHtml(link.url)}" rel="noopener noreferrer"><span>Download Stumbl — ${link.url.includes('apps.apple.com') ? 'iOS' : 'Android'}</span><img src="${link.badge}" width="150" height="50" alt="${escapeHtml(link.label)}" /></a>`).join('');
  const status = eventStatus(preview);
  const recurrence = occurrences.length > 1 ? `<p class="note">${occurrences.length} scheduled showings. Choose a showing below for its date and time.</p>` : '';
  const sharing = !unavailable ? `<section class="actions" aria-label="Share event"><button type="button" id="share-event">Share event</button><label for="event-link">Copy or save this event link${noindex ? ' — only share this private invitation with intended guests' : ''}</label><input id="event-link" readonly value="${safeCanonical}" /><p id="share-note" class="note" role="status"></p></section>` : '';
  const download = `<section class="download"><h2>Download Stumbl</h2><p>Discover local events, save your favorites, and create events of your own.</p>${storeButtons || '<p class="note">The Android download is not available yet. You can keep viewing this event here.</p>'}<p class="note">After installing, return to this page or your original message and tap the event link again. Installation does not automatically reopen this event.</p></section>`;
  const shareScript = `<script src="/event-page.js" defer></script>`;
  const calendarControls = occurrences.length ? `<section class="calendar" aria-label="Save event to calendar"><h2>Save to Calendar</h2><form method="get" action="${calendarAction}"><input type="hidden" name="event" value="${escapeHtml(preview.id)}" />${privateToken ? `<input type="hidden" name="invite" value="${escapeHtml(privateToken)}" />` : ''}${occurrences.length > 1 ? `<label for="showing">Choose a showing</label><select id="showing" name="occurrence">${occurrenceOptions}</select>` : `<input type="hidden" name="occurrence" value="${escapeHtml(occurrences[0]?.id || '')}" />`}<div class="calendar-actions"><button type="submit" name="provider" value="ics">Save to Calendar</button><button type="submit" name="provider" value="google" class="secondary">Google Calendar</button><button type="submit" name="provider" value="outlook" class="secondary">Outlook</button></div></form><p>Opening a calendar option records Calendar Interest, not attendance.</p></section>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />${noindex ? '<meta name="robots" content="noindex,nofollow" />' : ''}<link rel="canonical" href="${safeCanonical}" /><title>${socialTitle} | ${APP_NAME}</title><meta name="description" content="${socialText}" /><meta property="og:type" content="website" /><meta property="og:site_name" content="${APP_NAME}" /><meta property="og:title" content="${socialTitle}" /><meta property="og:description" content="${socialText}" /><meta property="og:url" content="${safeCanonical}" />${socialImage ? `<meta property="og:image" content="${socialImage}" /><meta property="og:image:secure_url" content="${socialImage}" /><meta property="og:image:type" content="${socialImageMeta.type}" /><meta property="og:image:width" content="${socialImageMeta.width}" /><meta property="og:image:height" content="${socialImageMeta.height}" /><meta property="og:image:alt" content="${socialTitle} event banner" /><meta name="twitter:image" content="${socialImage}" /><meta name="twitter:image:alt" content="${socialTitle} event banner" />` : ''}<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${socialTitle}" /><meta name="twitter:description" content="${socialText}" /><style>.store-badge{display:inline-flex;margin:12px 8px 12px 0;max-width:100%}.store-badge img{display:block;max-width:100%}#event-link{width:100%;min-width:0;padding:12px;font:inherit;border-radius:8px}h1,p,address{overflow-wrap:anywhere}.status{color:#8ee8dc;font-weight:800}.store-badge:focus-visible{outline:3px solid #20b8a5;outline-offset:4px}:root{--navy:#101527;--navy2:#18233b;--cream:#fff8ea;--teal:#20b8a5;--muted:#aab7c7;--line:#2b3954}*{box-sizing:border-box}body{margin:0;background:#07111f;color:#fff;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{width:min(100%,720px);margin:auto;min-height:100vh;background:var(--navy);box-shadow:0 0 56px rgba(0,0,0,.42)}.hero{min-height:276px;background:linear-gradient(0deg,rgba(9,16,31,.97),rgba(9,16,31,.08) 68%);display:block;padding:0}.hero-image{display:block;width:100%;height:auto;max-height:560px;object-fit:contain;background:#07111f}.hero-image.is-fallback{height:250px;padding:24px}.hero-copy{padding:26px}.eyebrow{font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#8ee8dc}.hero h1{font-size:clamp(31px,8vw,49px);line-height:1.04;margin:8px 0 0}.content{padding:22px}.when{font-size:17px;line-height:1.45;font-weight:900;color:#b6f4ec;margin:0 0 13px}.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{background:#1f5b62;color:#ecfffc;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:850}.creator{margin:16px 0 25px;color:#c8d4df;font-weight:750}.verified{color:#8ee8dc;font-size:13px}.section{margin:26px 0}.section h2,.calendar h2,.download h2{font-size:22px;margin:0 0 11px}.section p,.section address{font-size:16px;line-height:1.55;color:#e6edf4;font-style:normal;white-space:pre-wrap}.card{border:1px solid var(--line);background:var(--navy2);border-radius:19px;overflow:hidden}.location-copy{padding:16px}.map{display:block;width:100%;height:190px;border:0;background:#202e44}.button,.store,button{display:flex;align-items:center;justify-content:center;min-height:52px;border:0;border-radius:16px;background:var(--teal);color:#06211f;text-decoration:none;font:900 15px inherit;padding:12px;cursor:pointer}.directions{margin-top:14px}.activities{margin-top:18px;border-top:1px solid var(--line);padding-top:14px;color:#d9e5ed}.activities>div{padding-top:8px}.calendar{margin:28px 0;padding:19px;border:1px solid #2f5f66;border-radius:21px;background:#112b3c}.calendar label,.calendar p{display:block;color:#d6e5ef;font-size:13px;line-height:1.45}.calendar select{width:100%;margin:8px 0 12px;border:1px solid #52717b;border-radius:12px;background:#0c1d31;color:#fff;padding:12px;font:700 14px inherit}.calendar-actions{display:grid;gap:9px}.calendar .secondary{background:#e4f6f2;color:#076d64}.actions{display:grid;gap:10px;margin:26px 0}.note{font-size:13px;line-height:1.45;color:var(--muted);margin:0}.download{margin:30px 0 5px;padding:22px;border-radius:22px;background:#0a0f1d;border:1px solid #24334d}.download p{color:#c8d4df;line-height:1.5}.store{margin-top:10px;background:#f5a000;color:#182033}@media(min-width:760px){body{padding:32px}.page{border-radius:28px;overflow:hidden}.hero{min-height:330px}.content{padding:30px}.calendar-actions{grid-template-columns:1.5fr 1fr 1fr}}</style></head><body><main class="page"><section class="hero">${heroImage}<div class="hero-copy"><div class="eyebrow">${unavailable ? APP_NAME : (preview.visibility === 'private' ? 'Private invitation' : APP_NAME)}</div><h1>${safeTitle}</h1></div></section><div class="content">${unavailable ? `<p>${safeDescription}</p>` : `<p class="when">${escapeHtml(formatRange(preview.start_time, preview.end_time, preview.timezone))} · ${escapeHtml(validTimezone(preview.timezone))}</p><p class="status">${status}</p>${recurrence}<p class="note">${escapeHtml(formatPrice(preview))}. ${preview.ticket_sales_enabled ? 'Check availability in Stumbl.' : 'Contact the organizer for attendance details.'}</p><div class="chips">${chips(categories)}</div><div class="creator">Created by ${escapeHtml(creator.display_name || creator.username || 'Stumbl creator')}${creator.is_verified ? '<span class="verified"> · Verified</span>' : ''}</div><section class="section"><h2>About this event</h2><p>${safeDescription}</p>${activityMarkup}</section>${addressLabel(preview) || preview.location_details || preview.parking_notes ? `<section class="section"><h2>Location details</h2><div class="card"><div class="location-copy"><address>${escapeHtml(addressLabel(preview) || preview.location_details || 'Location details will be shared by the organizer.')}</address>${preview.location_details ? `<p>${escapeHtml(preview.location_details)}</p>` : ''}${preview.parking_notes ? `<p><strong>Parking</strong><br />${escapeHtml(preview.parking_notes)}</p>` : ''}${maps ? `<a class="button directions" href="${escapeHtml(maps)}" rel="noopener noreferrer" target="_blank">Get Directions</a>` : ''}</div>${mapEmbed ? `<iframe class="map" title="Event location map" loading="lazy" referrerpolicy="no-referrer" src="${escapeHtml(mapEmbed)}"></iframe>` : ''}</div></section>` : ''}${calendarControls}<section class="actions"><a class="button" href="${safeHandoff}">Open in Stumbl</a><p class="note">This uses an HTTPS app link. Without Stumbl installed, this preview remains available. If a social or messaging browser keeps the link here, use its menu to open in Safari or Chrome, then tap Open in Stumbl.</p></section>${sharing}`}${download}</div></main>${shareScript}</body></html>`;
}

module.exports = { fetchEventPreview, renderEventPreview, escapeHtml, appHandoffUrl, formatRange, shareDescription, invitationTokenFromCanonicalUrl, calendarOccurrences, addressLabel, genuineClassificationValues, eventStatus, validTimezone };
