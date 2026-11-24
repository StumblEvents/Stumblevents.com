export default {
  async fetch() {
    const fingerprints = String(process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '').split(/[,\n]/).map(value => value.trim()).filter(Boolean);
    const verified = process.env.ANDROID_APP_LINKS_VERIFIED === 'true';
    if (verified && (!fingerprints.length || fingerprints.some(value => !/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(value)))) {
      return Response.json({ error: 'Invalid production signing configuration' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(verified ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: {
      namespace: 'android_app', package_name: 'com.stumbl.community', sha256_cert_fingerprints: fingerprints,
    } }] : [], { headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  },
};
