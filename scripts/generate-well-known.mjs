import fs from "node:fs/promises";
import path from "node:path";

const productionBundleId = "com.stumbl.community";
const developmentBundleId = "com.stumbl.community.dev";

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} must be configured for the Vercel build.`);
  return value;
}

function fingerprints(name) {
  const values = requiredEnvironment(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.length) throw new Error(`${name} must contain at least one fingerprint.`);
  return values;
}

function aasa({ teamId, developmentTeamId }) {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [`${developmentTeamId}.${developmentBundleId}`],
          components: [
            { "/": "/events/*", "?": { app: "development" } },
            { "/": "/invite/*", "?": { app: "development" } },
            { "/": "/creator/stripe/development/return" },
            { "/": "/creator/stripe/development/refresh" },
          ],
        },
        {
          appIDs: [`${teamId}.${productionBundleId}`],
          components: [
            { "/": "/events/*" },
            { "/": "/invite/*" },
            { "/": "/creator/stripe/return" },
            { "/": "/creator/stripe/refresh" },
          ],
        },
      ],
    },
  };
}

function assetLinks({ productionFingerprints, developmentFingerprints }) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: productionBundleId,
        sha256_cert_fingerprints: productionFingerprints,
      },
    },
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: developmentBundleId,
        sha256_cert_fingerprints: developmentFingerprints,
      },
    },
  ];
}

const outputRoot = path.resolve(process.env.WELL_KNOWN_OUTPUT_DIR || process.cwd());
const outputDirectory = path.join(outputRoot, ".well-known");
const teamId = requiredEnvironment("APPLE_TEAM_ID");
const developmentTeamId = requiredEnvironment("APPLE_DEV_TEAM_ID");
const productionFingerprints = fingerprints("ANDROID_SHA256_CERT_FINGERPRINTS");
const developmentFingerprints = fingerprints("ANDROID_DEV_SHA256_CERT_FINGERPRINTS");

await fs.mkdir(outputDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(
    path.join(outputDirectory, "apple-app-site-association"),
    `${JSON.stringify(aasa({ teamId, developmentTeamId }), null, 2)}\n`
  ),
  fs.writeFile(
    path.join(outputDirectory, "assetlinks.json"),
    `${JSON.stringify(assetLinks({ productionFingerprints, developmentFingerprints }), null, 2)}\n`
  ),
]);
