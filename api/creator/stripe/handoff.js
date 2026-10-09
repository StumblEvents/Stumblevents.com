const CALLBACKS = {
  return: {
    title: "Returning to Stumbl",
    message: "Your Stripe payout setup is returning to Stumbl.",
  },
  refresh: {
    title: "Continue in Stumbl",
    message: "Your Stripe payout setup is returning to Stumbl so you can continue.",
  },
};

function handoffPage({ appUrl, appName, title, message }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { align-items: center; background: #f7f7f8; color: #171719; display: flex; margin: 0; min-height: 100vh; padding: 24px; text-align: center; }
      main { margin: auto; max-width: 28rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
      p { color: #56565d; line-height: 1.5; margin: 0 0 1.5rem; }
      a { background: #171719; border-radius: 0.6rem; color: #fff; display: inline-block; font-weight: 600; padding: 0.8rem 1.1rem; text-decoration: none; }
      a:focus-visible { outline: 3px solid #5b7cfa; outline-offset: 3px; }
      @media (prefers-color-scheme: dark) { body { background: #171719; color: #fff; } p { color: #c8c8ce; } a { background: #fff; color: #171719; } }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <a id="open-stumbl" href="${appUrl}">Open ${appName}</a>
      <p id="fallback" hidden>If ${appName} did not open automatically, tap the button above.</p>
    </main>
    <script>
      window.setTimeout(function () {
        window.location.replace(${JSON.stringify(appUrl)});
      }, 80);
      window.setTimeout(function () {
        document.getElementById("fallback").hidden = false;
      }, 1200);
    </script>
  </body>
</html>`;
}

function requestsNativeAuthHandoff(request) {
  try {
    return new URL(request?.url).searchParams.get("native_auth") === "1";
  } catch {
    return false;
  }
}

export function createStripeHandoffResponse(callback, environment = "production", request) {
  const handoff = CALLBACKS[callback];

  if (!handoff) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const isDevelopment = environment === "development";
  const scheme = isDevelopment ? "stumbl-dev" : "stumbl";
  const appName = isDevelopment ? "Stumbl Dev" : "Stumbl";
  const appUrl = `${scheme}://creator/stripe/${callback}`;

  // Stripe requires an HTTPS return URL, but iOS ASWebAuthenticationSession
  // completes only when its main frame navigates to the custom scheme supplied
  // to openAuthSessionAsync. This server redirect crosses that boundary without
  // relying on JavaScript execution in the callback page.
  if (requestsNativeAuthHandoff(request)) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: appUrl,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(handoffPage({ ...handoff, appUrl, appName }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

export default {
  async fetch(request) {
    const callback = new URL(request.url).searchParams.get("callback");
    return createStripeHandoffResponse(callback, "production", request);
  },
};
