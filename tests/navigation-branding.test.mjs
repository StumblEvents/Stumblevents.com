import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const WORDMARK_URL = "https://ndfwnylpwrutbvhheesl.supabase.co/storage/v1/object/public/email-assets/stumbl-email-logo.png";
const headerPages = ["index.html", "about.html", "support/index.html"];

test("shared navigation headers use the accessible Stumbl wordmark without changing their home links", async () => {
  const pages = await Promise.all(headerPages.map((path) => readFile(path, "utf8")));

  for (const page of pages) {
    const brand = page.match(/<a class="brand"[\s\S]*?<\/a>/)?.[0] ?? "";
    assert.match(brand, /aria-label="Stumbl home"/);
    assert.match(brand, new RegExp(`src="${WORDMARK_URL}"`));
    assert.match(brand, /alt="Stumbl"/);
    assert.doesNotMatch(brand, /icon\.png|<span>Stumbl<\/span>/);
  }
});

test("shared navigation wordmark preserves its full responsive aspect ratio", async () => {
  const [css, aboutCss] = await Promise.all([
    readFile("styles.css", "utf8"),
    readFile("about.css", "utf8"),
  ]);

  assert.match(css, /width: clamp\(100px, 30vw, 120px\)/);
  assert.match(css, /@media \(min-width: 621px\) \{\s*\.brand img \{ width: clamp\(120px, 8vw, 130px\); \}/);
  assert.match(css, /height: auto/);
  assert.match(css, /object-fit: contain/);
  assert.match(aboutCss, /\.site-header nav \{\s*width: 100%;\s*justify-content: flex-start;\s*flex-wrap: wrap;/);
});
