const LINK_TARGETS = {
  development: {
    environment: 'development',
    scheme: 'stumbl-dev',
    bundleIdentifier: 'com.stumbl.community.dev',
  },
  production: {
    environment: 'production',
    scheme: 'stumbl',
    bundleIdentifier: 'com.stumbl.community',
  },
};

function normalizeLinkTarget(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['dev', 'development', 'staging', 'stumbl-dev', 'com.stumbl.community.dev'].includes(normalized)) {
    return LINK_TARGETS.development;
  }
  return LINK_TARGETS.production;
}

function defaultLinkTarget() {
  return normalizeLinkTarget(process.env.STUMBL_SHARE_LINK_TARGET || process.env.EXPO_PUBLIC_SHARE_LINK_TARGET || process.env.APP_VARIANT);
}

function linkTargetFromRequest(req) {
  return normalizeLinkTarget(req?.query?.app || req?.query?.target || req?.query?.env || defaultLinkTarget().environment);
}

function stumblRequestBaseUrl(req) {
  const forwardedHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  const host = String(forwardedHost || '').split(',')[0].trim().toLocaleLowerCase().replace(/:\d+$/, '');
  return host === 'stumblevents.com' || host === 'www.stumblevents.com' ? `https://${host}` : '';
}

function configuredBaseUrl(req) {
  // Shared links begin on the associated apex host, then Vercel redirects a
  // browser to www. Preserve that browser host for canonical preview URLs;
  // renderEventPreview deliberately switches only the explicit app handoff
  // back to the apex associated host.
  const requestBaseUrl = stumblRequestBaseUrl(req);
  if (requestBaseUrl) return requestBaseUrl;
  const configured = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
  if (configured) return configured;
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

function appendTargetParam(url, target) {
  if (target.environment !== 'development') return url;
  const parsed = new URL(url);
  parsed.searchParams.set('app', 'development');
  return parsed.toString();
}

function webEventUrl(baseUrl, eventId, target) {
  return appendTargetParam(`${baseUrl.replace(/\/+$/, '')}/events/${encodeURIComponent(eventId)}`, target);
}

function webInviteUrl(baseUrl, token, target) {
  return appendTargetParam(`${baseUrl.replace(/\/+$/, '')}/invite/${encodeURIComponent(token)}`, target);
}

function appEventUrl(eventId, target, inviteToken) {
  const suffix = inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : '';
  return `${target.scheme}://event/${encodeURIComponent(eventId)}${suffix}`;
}

function appInviteUrl(token, target, eventId) {
  const suffix = eventId ? `?event_id=${encodeURIComponent(eventId)}` : '';
  return `${target.scheme}://invite/${encodeURIComponent(token)}${suffix}`;
}

function redactedAppInviteUrl(target, eventId) {
  const suffix = eventId ? `?event_id=${encodeURIComponent(eventId)}` : '';
  return `${target.scheme}://invite/[redacted]${suffix}`;
}

module.exports = {
  LINK_TARGETS,
  normalizeLinkTarget,
  defaultLinkTarget,
  linkTargetFromRequest,
  stumblRequestBaseUrl,
  configuredBaseUrl,
  webEventUrl,
  webInviteUrl,
  appEventUrl,
  appInviteUrl,
  redactedAppInviteUrl,
};
