const PACKAGE_NAME = "com.stumbl.community";
const DEV_PACKAGE_NAME = "com.stumbl.community.dev";

function fingerprints(environmentVariable) {
  return String(process.env[environmentVariable] || "")
    .split(",")
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

    const body = [
      productionFingerprints.length > 0
        ? {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PACKAGE_NAME,
              sha256_cert_fingerprints: productionFingerprints,
            },
          }
        : null,
      developmentFingerprints.length > 0
        ? {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: DEV_PACKAGE_NAME,
              sha256_cert_fingerprints: developmentFingerprints,
            },
          }
        : null,
    ].filter(Boolean);

    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
