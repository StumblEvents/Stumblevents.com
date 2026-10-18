const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });

// Keep validation deliberately format-agnostic: Supabase owns TokenHash encoding.
// Reject only empty, whitespace/control-containing, and unreasonably long values.
const TOKEN_HASH_PATTERN = /^[\x21-\x7E]{16,1024}$/;

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ verified: false }, 405);
    }

    const body = await request.json().catch(() => null);
    const tokenHash = typeof body?.token_hash === "string"
      ? body.token_hash.trim()
      : "";
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!TOKEN_HASH_PATTERN.test(tokenHash)) {
      return json({ verified: false, reason: "invalid_or_expired" }, 400);
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ verified: false, reason: "unavailable" }, 503);
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        // Supabase documents `email` as the verification type for signup Email OTP/TokenHash.
        body: JSON.stringify({ token_hash: tokenHash, type: "email" }),
      });

      if (!response.ok) {
        return json({ verified: false, reason: "invalid_or_expired" }, 400);
      }

      // The successful response can include a session; deliberately discard it.
      await response.body?.cancel();

      return json({ verified: true });
    } catch {
      return json({ verified: false, reason: "unavailable" }, 503);
    }
  },
};
