import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createLocalPreviewServer } from "../scripts/local-preview.mjs";

test("Support links to account deletion without exposing draft legal documents", async () => {
  const support = await readFile("support/index.html", "utf8");
  for (const route of ["/privacy", "/terms", "/creator-agreement", "/seller-agreement", "/refund-policy"]) {
    assert.doesNotMatch(support, new RegExp(`href="${route}"`));
  }
  assert.match(support, /href="\/delete-account"/);
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
