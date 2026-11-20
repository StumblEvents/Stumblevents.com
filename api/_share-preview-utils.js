const DEFAULT_SIGNED_IMAGE_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_SHARE_FALLBACK_IMAGE_PATH = '/assets/stumbl-wordmark.png?v=20261120';
const DEFAULT_SHARE_IMAGE_WIDTH = 1200;
const DEFAULT_SHARE_IMAGE_HEIGHT = 630;

function safeHttpsUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function absoluteUrl(baseUrl, path) {
  try {
    return new URL(path, `${String(baseUrl || '').replace(/\/+$/, '')}/`).toString();
  } catch {
    return '';
  }
}

function canonicalStumblAssetUrl(value, baseUrl) {
  const url = safeHttpsUrl(value);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if ((host === 'stumblevents.com' || host === 'www.stumblevents.com') && ['/stumbl-share-preview.png', '/stumbl-share-preview.jpg'].includes(parsed.pathname)) {
      return absoluteUrl(baseUrl || 'https://www.stumblevents.com', DEFAULT_SHARE_FALLBACK_IMAGE_PATH);
    }
  } catch {}
  return url;
}

function resolveShareFallbackImageUrl(baseUrl) {
  return canonicalStumblAssetUrl(process.env.EXPO_PUBLIC_SHARE_FALLBACK_IMAGE_URL, baseUrl)
    || canonicalStumblAssetUrl(process.env.STUMBL_SHARE_FALLBACK_IMAGE_URL, baseUrl)
    || canonicalStumblAssetUrl(process.env.EXPO_PUBLIC_PRIVATE_INVITE_IMAGE_URL, baseUrl)
    || canonicalStumblAssetUrl(process.env.STUMBL_PRIVATE_INVITE_IMAGE_URL, baseUrl)
    || canonicalStumblAssetUrl(absoluteUrl(baseUrl, DEFAULT_SHARE_FALLBACK_IMAGE_PATH), baseUrl);
}

function publicStorageImageUrl(supabaseUrl, bucket, path) {
  const cleanPath = String(path || '').trim().replace(/^\/+/, '');
  if (!supabaseUrl || !cleanPath) return '';
  const absolute = safeHttpsUrl(cleanPath);
  if (absolute) return absolute;
  const encodedPath = cleanPath.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}

function storageBucketIsPublic(bucket) {
  // Event banners are private by default.  Do not publish a storage URL that
  // a crawler cannot read: WhatsApp treats that as a failed preview image and
  // does not reliably retry the page.  Deployments that intentionally make a
  // bucket public can opt in explicitly.
  return String(process.env[`STUMBL_${String(bucket || '').replace(/[^a-z0-9]/gi, '_').toUpperCase()}_PUBLIC`] || '').toLowerCase() === 'true';
}

function signedImageTtlSeconds() {
  const parsed = Number.parseInt(String(process.env.STUMBL_SHARE_IMAGE_SIGNED_URL_TTL_SECONDS || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SIGNED_IMAGE_TTL_SECONDS;
}

function normalizeSignedStorageUrl(supabaseUrl, signedPath) {
  const value = String(signedPath || '').trim();
  if (!value) return '';
  const absolute = safeHttpsUrl(value);
  if (absolute) return absolute;
  if (value.startsWith('/storage/v1/')) return `${supabaseUrl}${value}`;
  if (value.startsWith('/object/')) return `${supabaseUrl}/storage/v1${value}`;
  if (value.startsWith('object/')) return `${supabaseUrl}/storage/v1/${value}`;
  return '';
}

async function signedStorageImageUrl(supabaseUrl, bucket, path, serviceRoleKey, context = 'share-preview') {
  const cleanPath = String(path || '').trim().replace(/^\/+/, '');
  if (!supabaseUrl || !cleanPath) return '';
  const absolute = safeHttpsUrl(cleanPath);
  if (absolute) return absolute;
  if (!serviceRoleKey) return '';

  const encodedPath = cleanPath.split('/').map((part) => encodeURIComponent(part)).join('/');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: signedImageTtlSeconds() }),
  });

  if (!response.ok) {
    console.warn('[Stumbl share preview] Could not sign event banner URL.', {
      context,
      bucket,
      status: response.status,
    });
    return '';
  }

  const body = await response.json();
  return normalizeSignedStorageUrl(supabaseUrl, body?.signedURL || body?.signedUrl || body?.signed_url);
}

async function resolveEventPreviewImageUrl({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  bannerImagePath,
  imageUrl,
  fallbackImageUrl,
  context,
  visibility = 'private',
}) {
  let signedBannerUrl = '';
  try {
    signedBannerUrl = await signedStorageImageUrl(supabaseUrl, bucket, bannerImagePath, serviceRoleKey, context);
  } catch {
    // Image-service outages must not hide the authorized event page.
  }
  if (signedBannerUrl) return signedBannerUrl;
  // Only an already-authorized public event may use this anonymous fallback.
  // Probe only our configured storage origin, never an arbitrary remote URL.
  if (visibility === 'public' && bannerImagePath) {
    const candidate = publicStorageImageUrl(supabaseUrl, bucket, bannerImagePath);
    try {
      if (new URL(candidate).origin === new URL(supabaseUrl).origin
          && new URL(candidate).pathname.startsWith('/storage/v1/object/public/')) {
        const response = await fetch(candidate, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(5000) });
        if (response.ok && response.headers.get('content-type')?.toLowerCase().startsWith('image/')) return candidate;
      }
    } catch {
      // Missing/inaccessible banners continue to the safe fallback below.
    }
  }
  const publicBannerUrl = storageBucketIsPublic(bucket)
    ? publicStorageImageUrl(supabaseUrl, bucket, bannerImagePath)
    : '';
  return signedBannerUrl
    || publicBannerUrl
    || safeHttpsUrl(imageUrl)
    || safeHttpsUrl(fallbackImageUrl);
}

function imageContentTypeForUrl(imageUrl) {
  try {
    const pathname = new URL(String(imageUrl || '')).pathname.toLowerCase();
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  } catch {}
  return 'image/jpeg';
}

function shareImageMetadata(imageUrl) {
  const url = safeHttpsUrl(imageUrl);
  if (!url) return null;
  return {
    url,
    secureUrl: url,
    type: imageContentTypeForUrl(url),
    width: new URL(url).pathname === '/assets/stumbl-wordmark.png' ? 653 : DEFAULT_SHARE_IMAGE_WIDTH,
    height: new URL(url).pathname === '/assets/stumbl-wordmark.png' ? 309 : DEFAULT_SHARE_IMAGE_HEIGHT,
  };
}

module.exports = {
  absoluteUrl,
  publicStorageImageUrl,
  storageBucketIsPublic,
  resolveEventPreviewImageUrl,
  resolveShareFallbackImageUrl,
  safeHttpsUrl,
  shareImageMetadata,
  signedStorageImageUrl,
};
