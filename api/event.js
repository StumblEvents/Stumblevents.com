const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("id");

    if (!eventId || !UUID_PATTERN.test(eventId)) {
      return Response.json(
        { error: "A valid event ID is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json(
        { error: "Supabase is not configured." },
        { status: 500 }
      );
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
      const errorText = await response.text();

      console.error("Supabase event lookup failed:", {
        status: response.status,
        body: errorText,
      });

      return Response.json(
        { error: "Unable to load event." },
        { status: 502 }
      );
    }

    const events = await response.json();
    const event = events[0];

    if (!event) {
      return Response.json(
        { error: "Event not found or is not publicly viewable." },
        { status: 404 }
      );
    }

    return Response.json(event, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  },
};
