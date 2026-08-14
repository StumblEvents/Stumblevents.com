export const SITE_URL = "https://www.stumblevents.com";
export const STUMBL_LOGO_PATH = "/assets/icon.png";
export const STUMBL_LOGO_URL = `${SITE_URL}${STUMBL_LOGO_PATH}`;
export const EVENT_IMAGE_BUCKET = "event-images";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodeStoragePath(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function formatEventDate(startTime, endTime, timezone) {
  try {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;

    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Denver",
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Denver",
      hour: "numeric",
      minute: "2-digit",
    });

    const date = dateFormatter.format(start);
    const startText = timeFormatter.format(start);

    if (!end) {
      return `${date} - ${startText}`;
    }

    const endText = timeFormatter.format(end);

    return `${date} - ${startText}-${endText}`;
  } catch {
    return "";
  }
}

export function normalizeEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object") return null;

  const event = rawEvent.event && typeof rawEvent.event === "object"
    ? { ...rawEvent.event, ...rawEvent }
    : rawEvent;

  const id = event.id || event.event_id;
  const title = event.title || event.event_title;

  if (!id || !title) return null;

  return {
    id,
    title,
    description: event.description || event.event_description || "",
    start_time: event.start_time || event.event_start_time || null,
    end_time: event.end_time || event.event_end_time || null,
    timezone: event.timezone || event.event_timezone || null,
    visibility: event.visibility || event.event_visibility || null,
    banner_image_path:
      event.banner_image_path ||
      event.banner_path ||
      event.event_banner_image_path ||
      null,
    image_url:
      event.image_url ||
      event.banner_image_url ||
      event.banner_url ||
      event.preview_image_url ||
      event.og_image_url ||
      event.signed_banner_url ||
      null,
  };
}

export function firstRow(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  if (payload?.data) return firstRow(payload.data);
  return payload || null;
}

export function buildPublicStorageUrl(supabaseUrl, path) {
  if (!supabaseUrl || !path) return null;
  return `${supabaseUrl}/storage/v1/object/public/${EVENT_IMAGE_BUCKET}/${encodeStoragePath(path)}`;
}

export function eventHasBanner(event) {
  return Boolean(event?.image_url || event?.banner_image_path);
}

export function buildImageUrl({ event, supabaseUrl, inviteToken = null }) {
  if (!event) return STUMBL_LOGO_URL;

  if (inviteToken && eventHasBanner(event)) {
    const params = new URLSearchParams({
      event: event.id,
      invite: inviteToken,
    });

    return `${SITE_URL}/api/link-preview?${params.toString()}`;
  }

  if (event.image_url && /^https?:\/\//i.test(event.image_url)) {
    return event.image_url;
  }

  if (event.banner_image_path) {
    return buildPublicStorageUrl(supabaseUrl, event.banner_image_path);
  }

  return STUMBL_LOGO_URL;
}

export function buildShareUrl(eventId, inviteToken = null, legacyInvite = false) {
  if (legacyInvite && inviteToken) {
    return `${SITE_URL}/invite/${encodeURIComponent(inviteToken)}`;
  }

  const path = `${SITE_URL}/events/${encodeURIComponent(eventId)}`;

  if (!inviteToken) return path;

  const params = new URLSearchParams({ invite: inviteToken });
  return `${path}?${params.toString()}`;
}

export function renderGenericPreview() {
  return renderHtml({
    pageTitle: "Stumbl",
    title: "Stumbl",
    description: "Find local events, meetups, food, games, and community plans around you.",
    imageUrl: STUMBL_LOGO_URL,
    shareUrl: SITE_URL,
    ctaHref: SITE_URL,
    ctaText: "Open Stumbl",
  });
}

export function renderEventPreview({
  event,
  supabaseUrl,
  inviteToken = null,
  legacyInvite = false,
}) {
  const dateTime = formatEventDate(
    event.start_time,
    event.end_time,
    event.timezone
  );
  const description = event.description || dateTime;
  const imageUrl = buildImageUrl({ event, supabaseUrl, inviteToken });
  const shareUrl = buildShareUrl(event.id, inviteToken, legacyInvite);
  const ctaHref = inviteToken
    ? `stumbl://events/${encodeURIComponent(event.id)}?invite=${encodeURIComponent(inviteToken)}`
    : `stumbl://events/${encodeURIComponent(event.id)}`;

  return renderHtml({
    pageTitle: `${event.title} | Stumbl`,
    title: event.title,
    description,
    imageUrl,
    shareUrl,
    dateTime,
    ctaHref,
    ctaText: "Open in Stumbl",
  });
}

function renderHtml({
  pageTitle,
  title,
  description,
  imageUrl,
  shareUrl,
  dateTime = "",
  ctaHref,
  ctaText,
}) {
  const safePageTitle = escapeHtml(pageTitle);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImageUrl = escapeHtml(imageUrl || STUMBL_LOGO_URL);
  const safeShareUrl = escapeHtml(shareUrl || SITE_URL);
  const safeDateTime = escapeHtml(dateTime);
  const safeCtaHref = escapeHtml(ctaHref || SITE_URL);
  const safeCtaText = escapeHtml(ctaText || "Open Stumbl");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>${safePageTitle}</title>

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Stumbl">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImageUrl}">
  <meta property="og:url" content="${safeShareUrl}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImageUrl}">

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #0b101b;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .card {
      width: 100%;
      max-width: 600px;
      background: #121a29;
      border-radius: 28px;
      overflow: hidden;
    }

    .banner {
      width: 100%;
      aspect-ratio: 1.91 / 1;
      object-fit: cover;
      display: block;
    }

    .content {
      padding: 32px;
    }

    .brand {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 28px;
      opacity: 0.8;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 36px;
      line-height: 1.1;
    }

    .date {
      margin: 0 0 30px;
      font-size: 18px;
      opacity: 0.75;
    }

    .button {
      display: block;
      width: 100%;
      padding: 16px 20px;
      border-radius: 999px;
      background: #d5a93f;
      color: #111;
      text-decoration: none;
      text-align: center;
      font-weight: 700;
      font-size: 17px;
    }
  </style>
</head>

<body>
  <main class="card">
    <img class="banner" src="${safeImageUrl}" alt="">

    <div class="content">
      <div class="brand">Stumbl</div>

      <h1>${safeTitle}</h1>

      ${safeDateTime ? `<p class="date">${safeDateTime}</p>` : ""}

      <a class="button" href="${safeCtaHref}">
        ${safeCtaText}
      </a>
    </div>

  </main>
</body>
</html>`;
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
