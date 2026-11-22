import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createLocalPreviewServer } from "../scripts/local-preview.mjs";

const approvedRoutes = ["/terms", "/privacy", "/creator-agreement", "/seller-agreement"];
const inactiveRoutes = ["/refund-policy"];

test("Support and website footers link to the four published agreements", async () => {
  const [support, landing, legal] = await Promise.all([
    readFile("support/index.html", "utf8"),
    readFile("index.html", "utf8"),
    readFile("legal/index.html", "utf8"),
  ]);
  for (const route of approvedRoutes) {
    assert.match(support, new RegExp(`href="${route}"`));
    assert.match(landing, new RegExp(`href="${route}"`));
    assert.match(legal, new RegExp(`href="${route}"`));
  }
  for (const route of inactiveRoutes) {
    assert.doesNotMatch(support, new RegExp(`href="${route}"`));
  }
  assert.match(support, /href="\/delete-account"/);
});

test("only the four published agreements have public website routes", async () => {
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  for (const route of approvedRoutes) {
    assert(vercel.rewrites.some((rewrite) => rewrite.source === route && rewrite.destination === "/legal/index.html"));
  }
  for (const route of inactiveRoutes) {
    assert.equal(vercel.rewrites.some((rewrite) => rewrite.source === route), false);
  }
});

test("website legal content includes only the four published agreements", async () => {
  const source = await readFile("legal/legal-content.js", "utf8");
  assert.match(source, /"terms"/);
  assert.match(source, /"privacy"/);
  assert.match(source, /"creator-agreement"/);
  assert.match(source, /"seller-agreement"/);
  assert.doesNotMatch(source, /"refund-policy"/);
});
test("public account deletion request page is routed and self-contained", async () => {
  const [vercel, deletionPage] = await Promise.all([
    readFile("vercel.json", "utf8"),
    readFile("delete-account/index.html", "utf8"),
  ]);
  assert.match(vercel, /"source": "\/delete-account"/);
  assert.match(deletionPage, /Profile → Settings → Delete Account/);
  assert.match(deletionPage, /verify that you control the account/);
  assert.doesNotMatch(deletionPage, /href="\/privacy"/);
});

test("local preview resolves the public account deletion URL", async () => {
  const server = createLocalPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    for (const route of ["/delete-account", "/delete-account/", "/delete-account/index.html"]) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /Delete your Stumbl account/);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("local preview resolves each review-ready agreement", async () => {
  const server = createLocalPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    for (const route of approvedRoutes) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /id="legalDocument"/);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("sensitive minor-request fallbacks reveal no request or payment details", async () => {
  const [vercel, purchase, promotion] = await Promise.all([
    readFile("vercel.json", "utf8"),
    readFile("minor-purchase/index.html", "utf8"),
    readFile("minor-promotion/index.html", "utf8"),
  ]);
  assert.match(vercel, /"source": "\/minor-purchase"/);
  assert.match(vercel, /"source": "\/minor-promotion"/);
  const deploymentHeaders = JSON.parse(vercel).headers;
  for (const route of ["/minor-purchase", "/minor-promotion"]) {
    const headers = Object.fromEntries(deploymentHeaders.find((rule) => rule.source === route).headers.map(({ key, value }) => [key, value]));
    assert.equal(headers["Cache-Control"], "no-store, max-age=0");
    assert.equal(headers["Referrer-Policy"], "no-referrer");
    assert.equal(headers["X-Robots-Tag"], "noindex, nofollow, noarchive, nosnippet");
  }
  for (const page of [purchase, promotion]) {
    assert.match(page, /name="robots" content="noindex,nofollow"/);
    assert.match(page, /name="referrer" content="no-referrer"/);
    assert.match(page, /does not show/i);
    assert.match(page, /not available yet/i);
    assert.doesNotMatch(page, /<script/i);
  }
  const server = createLocalPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    for (const route of ["/minor-purchase", "/minor-promotion"]) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet");
      assert.doesNotMatch(await response.text(), /token=/i);
    }
    for (const legacyRoute of ["/minor-purchase/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "/minor-promotion/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]) {
      const response = await fetch(`http://127.0.0.1:${port}${legacyRoute}`, { redirect: "manual" });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("location"), null);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
