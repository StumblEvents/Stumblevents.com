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
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.length || values.some(value => !/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(value))) throw new Error(`${name} must contain valid SHA-256 certificate fingerprints.`);
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
            { "/": "/minor-purchase", "?": { app: "development" } },
            { "/": "/minor-promotion", "?": { app: "development" } },
            { "/": "/creator/stripe/development/return" },
            { "/": "/creator/stripe/development/refresh" },
          ],
        },
        {
          appIDs: [`${teamId}.${productionBundleId}`],
          components: [
            { "/": "/events/*" },
            { "/": "/event/*" },
            { "/": "/invite/*" },
            { "/": "/minor-purchase" },
            { "/": "/minor-promotion" },
            { "/": "/creator/stripe/return" },
            { "/": "/creator/stripe/refresh" },
          ],
        },
      ],
    },
  };
}

function assetLinks({ productionFingerprints }) {
  if (!productionFingerprints.length) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: productionBundleId,
        sha256_cert_fingerprints: productionFingerprints,
      },
    },
  ];
}

const outputRoot = path.resolve(process.env.WELL_KNOWN_OUTPUT_DIR || process.cwd());
const outputDirectory = path.join(outputRoot, ".well-known");
const teamId = requiredEnvironment("APPLE_TEAM_ID");
if (!/^[A-Z0-9]{10}$/.test(teamId)) throw new Error("Invalid Apple Team ID");
const developmentTeamId = String(process.env.APPLE_DEV_TEAM_ID || teamId).trim();
const productionFingerprints = process.env.ANDROID_APP_LINKS_VERIFIED === "true" ? fingerprints("ANDROID_SHA256_CERT_FINGERPRINTS") : [];
// Broad Android development domain delegation can intercept ordinary production event links.

await fs.mkdir(outputDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(
    path.join(outputDirectory, "apple-app-site-association"),
    `${JSON.stringify(aasa({ teamId, developmentTeamId }), null, 2)}\n`
  ),
  fs.writeFile(
    path.join(outputDirectory, "assetlinks.json"),
    `${JSON.stringify(assetLinks({ productionFingerprints }), null, 2)}\n`
  ),
]);
