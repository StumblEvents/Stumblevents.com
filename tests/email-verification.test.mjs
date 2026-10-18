import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const TOKEN_HASH = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN";

async function loadHandler() {
  const source = await readFile("api/email-verification-result.js", "utf8");
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
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
