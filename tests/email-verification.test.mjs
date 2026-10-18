import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const TOKEN_HASH = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN";

async function loadHandler() {
  const source = await readFile("api/email-verification-result.js", "utf8");
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

async function loadPageModule() {
  const source = await readFile("email-verified/verification.js", "utf8");
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

function pageFixture(hash = "") {
  const elements = new Map();
  for (const id of ["result-title", "resultMessage", "statusEyebrow", "statusIcon", "openStumbl"]) {
    elements.set(id, { id, className: "", textContent: "", hidden: id === "openStumbl" });
  }
  const replacements = [];
  return {
    documentRef: {
      title: "Email verification | Stumbl",
      getElementById: (id) => elements.get(id),
    },
    windowRef: {
      location: { hash, pathname: "/email-verified" },
      history: { replaceState: (...args) => replacements.push(args) },
    },
    elements,
    replacements,
  };
}

async function withSupabaseMock(mock, run) {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "publishable-test-key";
  globalThis.fetch = mock;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalKey;
  }
}

function verifyRequest(tokenHash = TOKEN_HASH, headers = {}) {
  return new Request("https://www.stumblevents.com/api/email-verification-result", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ token_hash: tokenHash }),
  });
}

test("verifies a fresh TokenHash with Supabase's email confirmation type", async () => {
  const handler = (await loadHandler()).default;
  let requestToSupabase;

  await withSupabaseMock(async (url, options) => {
    requestToSupabase = { url, options };
    return new Response(JSON.stringify({ session: { mock: true } }), { status: 200 });
  }, async () => {
    const response = await handler.fetch(verifyRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { verified: true });
  });

  assert.equal(requestToSupabase.url, "https://example.supabase.co/auth/v1/verify");
  assert.equal(requestToSupabase.options.method, "POST");
  assert.equal(requestToSupabase.options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(requestToSupabase.options.body), {
    token_hash: TOKEN_HASH,
    type: "email",
  });
});

test("rejects expired, reused, and Supabase-invalid TokenHashes without success", async () => {
  const handler = (await loadHandler()).default;
  const usedHashes = new Set();

  await withSupabaseMock(async (_url, options) => {
    const { token_hash: tokenHash } = JSON.parse(options.body);
    if (usedHashes.has(tokenHash) || tokenHash === `${TOKEN_HASH}expired`) {
      return new Response(JSON.stringify({ error: "otp_expired" }), { status: 400 });
    }
    usedHashes.add(tokenHash);
    return new Response("{}", { status: 200 });
  }, async () => {
    const first = await handler.fetch(verifyRequest());
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { verified: true });

    const reused = await handler.fetch(verifyRequest());
    assert.equal(reused.status, 400);
    assert.deepEqual(await reused.json(), { verified: false, reason: "invalid_or_expired" });

    const expired = await handler.fetch(verifyRequest(`${TOKEN_HASH}expired`));
    assert.equal(expired.status, 400);
    assert.deepEqual(await expired.json(), { verified: false, reason: "invalid_or_expired" });
  });
});

test("rejects malformed hashes and unrelated previously-verified sessions", async () => {
  const handler = (await loadHandler()).default;
  let calls = 0;

  await withSupabaseMock(async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  }, async () => {
    const invalid = await handler.fetch(verifyRequest("invalid"));
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { verified: false, reason: "invalid_or_expired" });

    const existingSession = await handler.fetch(verifyRequest("", {
      Authorization: "Bearer an-old-verified-account-session",
    }));
    assert.equal(existingSession.status, 400);
    assert.deepEqual(await existingSession.json(), { verified: false, reason: "invalid_or_expired" });
  });

  assert.equal(calls, 0);
});

test("returns a retryable failure when Supabase is unavailable", async () => {
  const handler = (await loadHandler()).default;

  await withSupabaseMock(async () => {
    throw new Error("network unavailable");
  }, async () => {
    const response = await handler.fetch(verifyRequest());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { verified: false, reason: "unavailable" });
  });
});

test("automatically verifies a TokenHash and removes it from browser history", async () => {
  const { initializeVerification } = await loadPageModule();
  const fixture = pageFixture(`#token_hash=${TOKEN_HASH}&type=email`);
  let resolveVerification;
  const verification = new Promise((resolve) => { resolveVerification = resolve; });
  let calls = 0;

  initializeVerification({
    ...fixture,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(url, "/api/email-verification-result");
      assert.equal(options.credentials, "omit");
      assert.equal(options.referrerPolicy, "no-referrer");
      assert.deepEqual(JSON.parse(options.body), { token_hash: TOKEN_HASH });
      return verification;
    },
  });

  assert.equal(calls, 1);
  assert.equal(fixture.replacements.length, 1);
  assert.deepEqual(fixture.replacements[0], [null, "Email verification | Stumbl", "/email-verified"]);
  assert.equal(fixture.elements.get("result-title").textContent, "Verifying your email…");

  resolveVerification(new Response(JSON.stringify({ verified: true }), { status: 200 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.elements.get("result-title").textContent, "Email verified!");
  assert.equal(fixture.elements.get("openStumbl").hidden, false);
});

test("page displays an accurate failed-verification result and does not offer the app button", async () => {
  const { initializeVerification } = await loadPageModule();
  const fixture = pageFixture(`#token_hash=${TOKEN_HASH}&type=email`);

  initializeVerification({
    ...fixture,
    fetchImpl: async () => new Response(JSON.stringify({ verified: false, reason: "invalid_or_expired" }), { status: 400 }),
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.elements.get("result-title").textContent, "We couldn’t verify this email link");
  assert.equal(fixture.elements.get("openStumbl").hidden, true);
});

test("page only starts automatic verification once when initialization is repeated", async () => {
  const { initializeVerification } = await loadPageModule();
  const fixture = pageFixture(`#token_hash=${TOKEN_HASH}&type=email`);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ verified: true }), { status: 200 });
  };

  initializeVerification({ ...fixture, fetchImpl });
  initializeVerification({ ...fixture, fetchImpl });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
});

test("email verification page uses stable asset URLs and responsive, image-free page styling", async () => {
  const [html, css, vercelConfig] = await Promise.all([
    readFile("email-verified/index.html", "utf8"),
    readFile("email-verified/verification.css", "utf8"),
    readFile("vercel.json", "utf8"),
  ]);
  const vercel = JSON.parse(vercelConfig);

  assert.match(html, /href="\/email-verified\/verification\.css"/);
  assert.match(html, /src="\/email-verified\/verification\.js"/);
  assert.match(html, /id="openStumbl" href="stumbl:\/\/"/);
  assert.equal(
    new URL("/email-verified/verification.css", "https://www.stumblevents.com/email-verified").pathname,
    "/email-verified/verification.css",
  );
  assert.doesNotMatch(css, /181C2F4B-1D1E-4964-94B7-0D2818F91464|url\(/);
  assert.match(css, /min-height: 100dvh/);
  assert.match(css, /width: clamp\(160px, 48vw, 190px\)/);
  assert.match(css, /background: var\(--cream\)/);
  assert.match(css, /\.open-button\[hidden\] \{ display: none; \}/);
  assert.equal(vercel.rewrites.some((rule) => rule.source.startsWith("/email-verified")), false);
  assert.deepEqual(vercel.rewrites.map((rule) => rule.source), [
    "/creator/stripe/return",
    "/creator/stripe/refresh",
    "/creator/stripe/development/return",
    "/creator/stripe/development/refresh",
    "/invite/:token",
    "/events/:id",
  ]);
});
