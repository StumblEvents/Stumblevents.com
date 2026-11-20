import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const eventPage = require("../api/event.js");
const invitePage = require("../api/invite.js");
const calendar = require("../api/calendar.js");

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function localFileForPathname(pathname) {
  if (pathname === "/" || pathname === "/index.html") return "index.html";
  if (pathname === "/support" || pathname === "/support/" || pathname === "/support/index.html") {
    return "support/index.html";
  }
  if (pathname === "/delete-account" || pathname === "/delete-account/" || pathname === "/delete-account/index.html") {
    return "delete-account/index.html";
  }
  if (["/privacy", "/terms", "/creator-agreement"].includes(pathname)) {
    return "legal/index.html";
  }
  if (pathname === "/minor-purchase") return "minor-purchase/index.html";
  if (pathname === "/minor-promotion") return "minor-promotion/index.html";
  return pathname.replace(/^\/+/, "");
}

function sensitiveRequestHeaders(pathname) {
  if (!/^\/minor-(purchase|promotion)$/.test(pathname)) return {};
  return {
    "Cache-Control": "no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  };
}

export function createLocalPreviewServer(root = rootDirectory) {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    // Recovery snapshots and deployment configuration are never preview assets.
    if (requestUrl.pathname.split("/").some((part) => part.startsWith("."))) {
      if (!requestUrl.pathname.startsWith("/.well-known/")) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
    }
    const eventMatch = requestUrl.pathname.match(/^\/events?\/([^/]+)$/);
    const inviteMatch = requestUrl.pathname.match(/^\/invite\/([^/]+)$/);
    const handler = eventMatch || inviteMatch || requestUrl.pathname === "/api/event"
      ? eventPage
      : requestUrl.pathname === "/api/invite" ? invitePage
      : requestUrl.pathname === "/api/calendar" ? calendar : null;
    if (handler) {
      request.query = Object.fromEntries(requestUrl.searchParams);
      if (eventMatch) request.query.id = decodeURIComponent(eventMatch[1]);
      if (inviteMatch) request.query = { ...request.query, invite: decodeURIComponent(inviteMatch[1]) };
      try {
        await handler(request, response);
      } catch {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end("Unable to load event");
      }
      return;
    }
    if (requestUrl.pathname.startsWith("/api/")) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const relativeFile = localFileForPathname(requestUrl.pathname);
    const absoluteFile = path.resolve(root, relativeFile);

    if (!absoluteFile.startsWith(`${root}${path.sep}`) && absoluteFile !== root) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    try {
      const fileStats = await stat(absoluteFile);
      if (fileStats.isDirectory()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const extension = path.extname(absoluteFile).toLowerCase();
      const content = await readFile(absoluteFile);
      response.writeHead(200, {
        "Content-Type": mimeTypes[extension] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        ...sensitiveRequestHeaders(requestUrl.pathname),
      });
      response.end(content);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createLocalPreviewServer().listen(port, "127.0.0.1", () => {
    console.log(`Stumbl local preview: http://127.0.0.1:${port}`);
  });
}
