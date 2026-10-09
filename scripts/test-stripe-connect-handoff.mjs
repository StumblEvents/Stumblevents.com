import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../api/creator/stripe/handoff.js", import.meta.url), "utf8");
const handoff = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const productionNativeReturn = handoff.createStripeHandoffResponse(
  "return",
  "production",
  new Request("https://www.stumblevents.com/creator/stripe/return?native_auth=1"),
);
assert.equal(productionNativeReturn.status, 302);
assert.equal(productionNativeReturn.headers.get("location"), "stumbl://creator/stripe/return");
assert.match(productionNativeReturn.headers.get("cache-control") || "", /no-store/);

const developmentNativeRefresh = handoff.createStripeHandoffResponse(
  "refresh",
  "development",
  new Request("https://www.stumblevents.com/creator/stripe/development/refresh?native_auth=1"),
);
assert.equal(developmentNativeRefresh.status, 302);
assert.equal(developmentNativeRefresh.headers.get("location"), "stumbl-dev://creator/stripe/refresh");

const fallback = handoff.createStripeHandoffResponse(
  "return",
  "production",
  new Request("https://www.stumblevents.com/creator/stripe/return"),
);
assert.equal(fallback.status, 200);
assert.match(fallback.headers.get("content-type") || "", /text\/html/);
assert.match(await fallback.text(), /Returning to Stumbl[\s\S]*Open Stumbl/);

for (const route of [
  "../api/creator/stripe/return.js",
  "../api/creator/stripe/refresh.js",
  "../api/creator/stripe/development/return.js",
  "../api/creator/stripe/development/refresh.js",
]) {
  const routeSource = fs.readFileSync(new URL(route, import.meta.url), "utf8");
  assert.match(routeSource, /async fetch\(request\)[\s\S]*?createStripeHandoffResponse\([\s\S]*?request\)/, `${route} passes callback query parameters to the handoff`);
}

console.log("Stripe Connect handoff tests passed");
