import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createLocalPreviewServer } from "../scripts/local-preview.mjs";

test("support URLs explicitly render the existing support page", async () => {
  const [config, supportPage] = await Promise.all([
    readFile("vercel.json", "utf8"),
    readFile("support/index.html", "utf8"),
  ]);
  const vercel = JSON.parse(config);
  const supportRoutes = vercel.rewrites.filter((route) =>
    route.source === "/support" || route.source === "/support/"
  );

  assert.deepEqual(supportRoutes, [
    { source: "/support", destination: "/support/index.html" },
    { source: "/support/", destination: "/support/index.html" },
  ]);
  assert.match(supportPage, /<title>Support \| Stumbl Events<\/title>/);
  assert.match(supportPage, /support@stumblevents\.com/);
  assert.match(supportPage, /href="\/support\/support\.css"/);
});

test("legacy beta URLs continue to reach launch updates", async () => {
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  assert(vercel.redirects.some((route) =>
    route.source === "/beta" && route.destination === "/#notify"
  ));
});

test("local preview renders Support HTML and never directory indexes", async () => {
  const server = createLocalPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    for (const path of ["/support", "/support/", "/support/index.html"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /^text\/html/);
      assert.match(html, /<title>Support \| Stumbl Events<\/title>/);
      assert.match(html, /Contact Support/);
      assert.doesNotMatch(html, /Index of/);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
