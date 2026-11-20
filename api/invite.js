const { configuredBaseUrl, linkTargetFromRequest, webInviteUrl } = require('./_share-link-config');
const { fetchEventPreview, renderEventPreview } = require('./_event-preview');
const { visitorTrackingId } = require('./_calendar-interest');

function sendHtml(req, res, status, html) {
  // Seed the anonymous identifier on the first-party HTML response. Safari may
  // not retain a cookie first set on an attachment download or cross-site redirect.
  visitorTrackingId(req, res);
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // Never cache a token-bearing response at Vercel or an intermediary.
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(html);
}

module.exports = async function invite(req, res) {
  const token = String(req.query.token || req.query.invite || req.query.invite_token || '').trim();
  const eventId = req.query.id || req.query.event;
  if (eventId) {
    req.query = { ...req.query, type: 'event', id: eventId, invite: token };
    return require('./_event-page')(req, res);
  }
  const baseUrl = configuredBaseUrl(req);
  const canonicalUrl = webInviteUrl(baseUrl, token, linkTargetFromRequest(req));
  try {
    const preview = token ? await fetchEventPreview({ eventId: null, inviteToken: token, baseUrl }) : null;
    return sendHtml(req, res, preview ? 200 : 404, renderEventPreview({ preview, canonicalUrl, noindex: true, userAgent: req.headers?.['user-agent'] }));
  } catch (error) {
    console.error('[Stumbl invite preview] Event preview failed.', { hasInviteToken: !!token, message: error?.message });
    return sendHtml(req, res, 500, renderEventPreview({ canonicalUrl, noindex: true, userAgent: req.headers?.['user-agent'] }));
  }
};
