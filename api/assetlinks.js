const PRODUCTION_PACKAGE_NAME = "com.stumbl.community";
const DEVELOPMENT_PACKAGE_NAME = "com.stumbl.community.dev";

function fingerprints(environmentVariable) {
  return String(process.env[environmentVariable] || "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export default {
  async fetch() {
    const productionFingerprints = fingerprints(
      "ANDROID_SHA256_CERT_FINGERPRINTS"
    );
    const developmentFingerprints = fingerprints(
      "ANDROID_DEV_SHA256_CERT_FINGERPRINTS"
    );

    if (!productionFingerprints.length && !developmentFingerprints.length) {
      return Response.json(
        { error: "Android App Links is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = [
      productionFingerprints.length
        ? {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PRODUCTION_PACKAGE_NAME,
              sha256_cert_fingerprints: productionFingerprints,
            },
          }
        : null,
      developmentFingerprints.length
        ? {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: DEVELOPMENT_PACKAGE_NAME,
              sha256_cert_fingerprints: developmentFingerprints,
            },
          }
        : null,
    ].filter(Boolean);

    return Response.json(body, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
