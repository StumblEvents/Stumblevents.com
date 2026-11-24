const APP_STORE_URL = 'https://apps.apple.com/us/app/stumbl-events/id6792025434';
// Do not enable until the public production listing has been verified.
const GOOGLE_PLAY_URL = null;
function downloadLinks(userAgent = '') {
  if (/android/i.test(userAgent)) return GOOGLE_PLAY_URL ? [{ label: 'Get it on Google Play', url: GOOGLE_PLAY_URL, badge: '/assets/google-play-badge.png' }] : [];
  return [{ label: 'Download on the App Store', url: APP_STORE_URL, badge: '/assets/app-store-badge.svg' },
    ...(!/iphone|ipad|ipod/i.test(userAgent) && GOOGLE_PLAY_URL ? [{ label: 'Get it on Google Play', url: GOOGLE_PLAY_URL, badge: '/assets/google-play-badge.png' }] : [])];
}
module.exports = { APP_STORE_URL, GOOGLE_PLAY_URL, downloadLinks };
