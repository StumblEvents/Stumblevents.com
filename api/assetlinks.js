const splitFingerprints = (value) =>
  String(value || "")
    .split(/[,\n]/)
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);

export default {
  async fetch() {
    const fingerprints = splitFingerprints(process.env.ANDROID_SHA256_CERT_FINGERPRINTS);

    if (fingerprints.length === 0) {
      return Response.json(
        { error: "Android App Links is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "com.stumbl.community",
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ],
      {
        headers: {
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  },
};
