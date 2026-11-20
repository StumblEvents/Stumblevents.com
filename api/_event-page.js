const { configuredBaseUrl, linkTargetFromRequest, webEventUrl, webInviteUrl } = require('./_share-link-config');
const { fetchEventPreview, renderEventPreview } = require('./_event-preview');
const { visitorTrackingId } = require('./_calendar-interest');

function sendHtml(req, res, status, html) {
  // Establish the browser-scoped anonymous ID before any calendar action.
  visitorTrackingId(req, res);
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // Private tokens must never be retained by a shared cache.
  res.setHeader('cache-control', status === 200 ? 'private, no-store' : 'no-store');
  // Do not forward an invitation URL (and its token) as a referrer to external links.
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(html);
}

function canonicalEventUrl(baseUrl, eventId, token, target) {
  if (!token) return webEventUrl(baseUrl, eventId, target);
  const url = new URL(webEventUrl(baseUrl, eventId, target));
  url.searchParams.set('invite', token);
  return url.toString();
}

async function trackQrScan(req, eventId, inviteToken) {
  if (!(req.query.source === 'qr' || req.query.qr) || !eventId) return;
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/rpc/track_event_analytics`, {
      method: 'POST',
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ p_event_id: eventId, p_event_type: 'qr_scan', p_invite_token: inviteToken || null, p_tracking_id: null, p_metadata: { source: 'web_event_preview' } }),
    });
  } catch {
    // Analytics is intentionally best effort and must not prevent an invite.
  }
}

module.exports = async function linkPreview(req, res) {
  const baseUrl = configuredBaseUrl(req);
  const target = linkTargetFromRequest(req);
  const type = String(req.query.type || '');
  const token = String(req.query.invite || req.query.token || req.query.invite_token || '').trim();
  const eventId = String(req.query.id || '').trim();
  const canonicalUrl = type === 'invite'
    ? webInviteUrl(baseUrl, token, target)
    : canonicalEventUrl(baseUrl, eventId, token, target);
  if ((type !== 'event' && type !== 'invite') || (!eventId && type !== 'invite') || (type === 'invite' && !token)) {
    return sendHtml(req, res, 404, renderEventPreview({ canonicalUrl, noindex: true, userAgent: req.headers?.['user-agent'] }));
  }
  try {
    const preview = await fetchEventPreview({ eventId: type === 'invite' ? null : eventId, inviteToken: token, baseUrl });
    const isPrivate = !!token || preview?.visibility === 'private';
    if (preview && type === 'event') void trackQrScan(req, eventId, token);
    return sendHtml(req, res, preview ? 200 : 404, renderEventPreview({ preview, canonicalUrl, noindex: isPrivate || !preview, userAgent: req.headers?.['user-agent'] }));
  } catch (error) {
    console.error('[Stumbl link preview] Event preview failed.', { eventId: eventId || null, hasInviteToken: !!token, message: error?.message });
    return sendHtml(req, res, 500, renderEventPreview({ canonicalUrl, noindex: true, userAgent: req.headers?.['user-agent'] }));
  }
};
