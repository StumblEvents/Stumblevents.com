const { fetchEventPreview } = require('./_event-preview');
const { visitorTrackingId } = require('./_calendar-interest');

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function utcIcsDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function eventLocation(preview) {
  return [preview.venue_name, preview.address, [preview.city, preview.state].filter(Boolean).join(', '), preview.zip].filter(Boolean).join(', ');
}

function selectedOccurrence(preview, occurrenceId) {
  const occurrences = Array.isArray(preview.occurrences) ? preview.occurrences.filter((row) => row?.start_at) : [];
  if (occurrenceId) return occurrences.find((row) => String(row.id) === String(occurrenceId)) || null;
  return occurrences.length === 1 ? occurrences[0] : (occurrences.length === 0 && preview.start_time ? { id: '', start_at: preview.start_time, end_at: preview.end_time || null, title: preview.title } : null);
}

function calendarDescription(preview) {
  return [preview.description, preview.parking_notes ? `Parking: ${preview.parking_notes}` : ''].filter(Boolean).join('\n\n');
}

function icsBody(preview, occurrence, canonicalUrl) {
  const now = utcIcsDate(new Date().toISOString());
  const start = utcIcsDate(occurrence.start_at);
  const end = utcIcsDate(occurrence.end_at || occurrence.start_at);
  const title = occurrence.title || preview.title;
  const eventUrl = canonicalUrl ? [`URL:${escapeIcs(canonicalUrl)}`] : [];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stumbl//Event Invitation//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${escapeIcs(`${preview.id}:${occurrence.id || start}@stumblevents.com`)}`, `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeIcs(title)}`, `DESCRIPTION:${escapeIcs(calendarDescription(preview))}`, `LOCATION:${escapeIcs(eventLocation(preview))}`, ...eventUrl, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}

function googleCalendarUrl(preview, occurrence, canonicalUrl) {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', occurrence.title || preview.title);
  url.searchParams.set('dates', `${utcIcsDate(occurrence.start_at)}/${utcIcsDate(occurrence.end_at || occurrence.start_at)}`);
  url.searchParams.set('details', [calendarDescription(preview), canonicalUrl].filter(Boolean).join('\n\n'));
  url.searchParams.set('location', eventLocation(preview));
  return url.toString();
}

function outlookCalendarUrl(preview, occurrence, canonicalUrl) {
  const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  url.searchParams.set('path', '/calendar/action/compose');
  url.searchParams.set('rru', 'addevent');
  url.searchParams.set('subject', occurrence.title || preview.title);
  url.searchParams.set('startdt', new Date(occurrence.start_at).toISOString());
  url.searchParams.set('enddt', new Date(occurrence.end_at || occurrence.start_at).toISOString());
  url.searchParams.set('body', [calendarDescription(preview), canonicalUrl].filter(Boolean).join('\n\n'));
  url.searchParams.set('location', eventLocation(preview));
  return url.toString();
}

async function recordCalendarInterest({ preview, occurrence, inviteToken, tracking, provider }) {
  const url = String(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !serviceRoleKey) return false;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/track_web_calendar_interest`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ p_event_id: preview.id, p_instance_id: occurrence.id || null, p_invite_token: inviteToken || null, p_tracking_id: tracking, p_provider: provider }),
    });
    return response.ok;
  } catch { return false; }
}

function unavailable(res) {
  res.statusCode = 404;
  res.setHeader('cache-control', 'no-store');
  res.end('Event unavailable');
}

module.exports = async function calendar(req, res) {
  const eventId = String(req.query.event || '').trim();
  const occurrenceId = String(req.query.occurrence || '').trim();
  const inviteToken = String(req.query.invite || '').trim();
  const provider = String(req.query.provider || 'ics').toLowerCase();
  if (!eventId || !['ics', 'google', 'outlook'].includes(provider)) return unavailable(res);
  try {
    const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || 'www.stumblevents.com').split(',')[0].trim();
    const baseUrl = `${protocol === 'http' ? 'http' : 'https'}://${host}`;
    const preview = await fetchEventPreview({ eventId, inviteToken, baseUrl });
    const occurrence = preview && selectedOccurrence(preview, occurrenceId);
    if (!preview || !occurrence || (Array.isArray(preview.occurrences) && preview.occurrences.length > 1 && !occurrenceId)) return unavailable(res);
    // A private invitation token authorizes this request only. Never copy it into
    // an .ics file or a third-party calendar-provider URL, where it could be shared.
    const canonicalUrl = preview.visibility === 'private' ? '' : new URL(`/events/${encodeURIComponent(preview.id)}`, baseUrl).toString();
    await recordCalendarInterest({ preview, occurrence, inviteToken, tracking: visitorTrackingId(req, res), provider });
    res.setHeader('cache-control', 'private, no-store');
    res.setHeader('referrer-policy', 'same-origin');
    if (provider === 'ics') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/calendar; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="${String(preview.title || 'stumbl-event').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 72)}.ics"`);
      return res.end(icsBody(preview, occurrence, canonicalUrl));
    }
    res.statusCode = 302;
    res.setHeader('location', provider === 'google' ? googleCalendarUrl(preview, occurrence, canonicalUrl) : outlookCalendarUrl(preview, occurrence, canonicalUrl));
    return res.end();
  } catch {
    return unavailable(res);
  }
};

module.exports.icsBody = icsBody;
module.exports.selectedOccurrence = selectedOccurrence;
