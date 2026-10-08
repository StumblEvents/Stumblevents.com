import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "stumbl-well-known-"));

try {
  await execFileAsync(process.execPath, ["scripts/generate-well-known.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      WELL_KNOWN_OUTPUT_DIR: temporaryDirectory,
      APPLE_TEAM_ID: "KKF26CHCH6",
      APPLE_DEV_TEAM_ID: "KKF26CHCH6",
      ANDROID_SHA256_CERT_FINGERPRINTS: "AA:BB,CC:DD",
      ANDROID_DEV_SHA256_CERT_FINGERPRINTS: "11:22",
    },
  });

  const aasa = JSON.parse(
    await fs.readFile(path.join(temporaryDirectory, ".well-known", "apple-app-site-association"), "utf8")
  );
  const assetLinks = JSON.parse(
    await fs.readFile(path.join(temporaryDirectory, ".well-known", "assetlinks.json"), "utf8")
  );
  const staticAasa = JSON.parse(
    await fs.readFile(path.join(root, ".well-known", "apple-app-site-association"), "utf8")
  );
  const vercel = JSON.parse(await fs.readFile(path.join(root, "vercel.json"), "utf8"));

  assert.equal(vercel.buildCommand, "node scripts/generate-well-known.mjs");
  assert(!vercel.rewrites.some((rule) => rule.source.startsWith("/.well-known/")));
  assert(vercel.headers.some((rule) => rule.source === "/.well-known/apple-app-site-association"));
  assert(vercel.headers.some((rule) => rule.source === "/.well-known/assetlinks.json"));
  assert.match(vercel.redirects[0].source, /apple-app-site-association/);
  assert.match(vercel.redirects[0].source, /assetlinks\\\.json/);

  const details = aasa.applinks.details;
  assert.deepEqual(details.map((detail) => detail.appIDs), [
    ["KKF26CHCH6.com.stumbl.community.dev"],
    ["KKF26CHCH6.com.stumbl.community"],
  ]);
  const [development, production] = details.map((detail) => detail.components.map((component) => component["/"]));
  assert.deepEqual(development, [
    "/events/*",
    "/invite/*",
    "/creator/stripe/development/return",
    "/creator/stripe/development/refresh",
  ]);
  assert.deepEqual(production, [
    "/events/*",
    "/invite/*",
    "/creator/stripe/return",
    "/creator/stripe/refresh",
  ]);
  assert.equal(staticAasa.applinks.details.length, 2);
  assert.deepEqual(assetLinks.map((entry) => entry.target.package_name), [
    "com.stumbl.community",
    "com.stumbl.community.dev",
  ]);
  assert.deepEqual(assetLinks[0].target.sha256_cert_fingerprints, ["AA:BB", "CC:DD"]);
  assert.deepEqual(assetLinks[1].target.sha256_cert_fingerprints, ["11:22"]);
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Static .well-known deployment routing tests passed.");
