const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEventDate(startTime, endTime, timezone) {
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
      return `${date} • ${startText}`;
    }

    const endText = timeFormatter.format(end);

    return `${date} • ${startText}–${endText}`;
  } catch {
    return "";
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("id");

    if (!eventId || !UUID_PATTERN.test(eventId)) {
      return new Response("Invalid event link.", {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response("Event service is unavailable.", {
        status: 500,
      });
    }

    const params = new URLSearchParams({
      select:
        "id,title,start_time,end_time,timezone,banner_image_path,image_url,visibility",
      id: `eq.${eventId}`,
      visibility: "eq.public",
      limit: "1",
    });

    const response = await fetch(
      `${supabaseUrl}/rest/v1/events?${params.toString()}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        "Supabase event lookup failed:",
        response.status,
        await response.text()
      );

      return new Response("Unable to load this event.", {
        status: 502,
      });
    }

    const events = await response.json();
    const event = events[0];

    if (!event) {
      return new Response("This event is unavailable.", {
        status: 404,
      });
    }

    const title = escapeHtml(event.title);

    const dateTime = escapeHtml(
      formatEventDate(
        event.start_time,
        event.end_time,
        event.timezone
      )
    );

    const bannerUrl = event.banner_image_path
      ? `${supabaseUrl}/storage/v1/object/public/event-images/${event.banner_image_path}`
      : event.image_url || null;

    const safeBannerUrl = bannerUrl
      ? escapeHtml(bannerUrl)
      : null;

    const canonicalUrl =
      `https://stumblevents.com/events/${encodeURIComponent(event.id)}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>${title} | Stumbl</title>

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Stumbl">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${dateTime}">
  <meta property="og:url" content="${canonicalUrl}">

  ${
    safeBannerUrl
      ? `
  <meta property="og:image" content="${safeBannerUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${dateTime}">
  <meta name="twitter:image" content="${safeBannerUrl}">
  `
      : `
  <meta name="twitter:card" content="summary">
  `
  }

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

    ${
      safeBannerUrl
        ? `<img class="banner" src="${safeBannerUrl}" alt="">`
        : ""
    }

    <div class="content">
      <div class="brand">Stumbl</div>

      <h1>${title}</h1>

      <p class="date">${dateTime}</p>

      <a
        class="button"
        href="stumbl://events/${encodeURIComponent(event.id)}"
      >
        Open in Stumbl
      </a>
    </div>

  </main>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
};
