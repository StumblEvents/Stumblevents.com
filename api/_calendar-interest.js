const crypto = require('crypto');

const COOKIE_NAME = 'stumbl_calendar_interest';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cookieValue(header, name) {
  const match = String(header || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}

function requestHost(req) {
  return String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim().toLowerCase().split(':')[0];
}

function cookieDomain(req) {
  // Share one first-party identifier between the native-link apex host and the
  // browser-preview www host. Preview/local hosts intentionally stay host-only.
  const host = requestHost(req);
  return host === 'stumblevents.com' || host === 'www.stumblevents.com' ? 'stumblevents.com' : '';
}

function appendSetCookie(res, value) {
  const existing = typeof res.getHeader === 'function' ? res.getHeader('set-cookie') : res?.headers?.['set-cookie'];
  const values = existing ? [...(Array.isArray(existing) ? existing : [existing]), value] : value;
  res.setHeader('set-cookie', values);
}

function visitorTrackingId(req, res) {
  const existing = cookieValue(req?.headers?.cookie, COOKIE_NAME);
  if (UUID_PATTERN.test(existing)) return existing;
  const id = crypto.randomUUID();
  const domain = cookieDomain(req);
  appendSetCookie(res, `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/;${domain ? ` Domain=${domain};` : ''} Max-Age=${ONE_YEAR_SECONDS}; HttpOnly; Secure; SameSite=Lax`);
  return id;
}

module.exports = { COOKIE_NAME, UUID_PATTERN, cookieDomain, cookieValue, visitorTrackingId };
