import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const VERSION = "20261018";
const publicPages = ["index.html", "about.html", "support/index.html", "email-verified/index.html"];
const pngAssets = new Map([
  ["assets/favicon-16.png", 16],
  ["assets/favicon-32.png", 32],
  ["assets/favicon-48.png", 48],
  ["assets/apple-touch-icon.png", 180],
  ["assets/favicon-192.png", 192],
  ["assets/favicon-512.png", 512],
]);

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("favicon derivatives have the requested dimensions and a multi-size ICO fallback", async () => {
  for (const [path, size] of pngAssets) {
    const image = await readFile(path);
    assert.deepEqual(pngDimensions(image), { width: size, height: size }, path);
  }

  const ico = await readFile("favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  const sizes = new Set();
  for (let index = 0; index < 3; index += 1) {
    const offset = 6 + index * 16;
    sizes.add(`${ico[offset]}x${ico[offset + 1]}`);
  }
  assert.deepEqual(sizes, new Set(["16x16", "32x32", "48x48"]));
});

test("public pages use versioned new favicon declarations instead of the prior icon", async () => {
  const pages = await Promise.all(publicPages.map((path) => readFile(path, "utf8")));
  for (const page of pages) {
    assert.match(page, new RegExp(`/assets/favicon-32\\.png\\?v=${VERSION}`));
    assert.match(page, new RegExp(`/assets/favicon-16\\.png\\?v=${VERSION}`));
    assert.match(page, new RegExp(`/assets/apple-touch-icon\\.png\\?v=${VERSION}`));
    assert.match(page, new RegExp(`/site\\.webmanifest\\?v=${VERSION}`));
    assert.doesNotMatch(page, /rel="icon" href="(?:\.\.\/)?assets\/icon\.png"/);
  }
});

test("manifest and generated public pages reference the website favicon set", async () => {
  const [manifestSource, previewSource, stripeSource] = await Promise.all([
    readFile("site.webmanifest", "utf8"),
    readFile("api/_preview.js", "utf8"),
    readFile("api/creator/stripe/handoff.js", "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert(manifest.icons.every((icon) => icon.src.endsWith(`?v=${VERSION}`)));
  assert.match(previewSource, /favicon-32\.png\?v=20261018/);
  assert.match(stripeSource, /favicon-32\.png\?v=20261018/);
});
