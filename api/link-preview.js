import { STUMBL_LOGO_URL, UUID_PATTERN } from "./_preview.js";
import {
  fetchPublicEvent,
  resolveBannerUrl,
  resolveInvite,
} from "./_supabase.js";

async function imageResponse(imageUrl) {
  const response = await fetch(imageUrl || STUMBL_LOGO_URL);

  if (!response.ok) {
    if (imageUrl !== STUMBL_LOGO_URL) {
      return imageResponse(STUMBL_LOGO_URL);
    }

    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    response.headers.get("Content-Type") || "image/png"
  );
  headers.set("Cache-Control", "no-store");

  return new Response(response.body, {
    status: 200,
    headers,
  });
}

function eventIdMatchesInvite(eventId, invitedEvent) {
  if (!eventId) return true;
  return invitedEvent?.id?.toLowerCase() === eventId.toLowerCase();
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("event") || url.searchParams.get("id");
    const inviteToken = url.searchParams.get("invite") || url.searchParams.get("token");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase image preview environment is not configured.");
      return imageResponse(STUMBL_LOGO_URL);
    }

    if (eventId && !UUID_PATTERN.test(eventId)) {
      return imageResponse(STUMBL_LOGO_URL);
    }

    let event = null;

    if (inviteToken) {
      event = await resolveInvite({
        supabaseUrl,
        supabaseAnonKey,
        inviteToken,
      });

      if (!eventIdMatchesInvite(eventId, event)) {
        return imageResponse(STUMBL_LOGO_URL);
      }
    } else if (eventId) {
      event = await fetchPublicEvent({
        supabaseUrl,
        supabaseAnonKey,
        eventId,
      });
    }

    if (!event) {
      return imageResponse(STUMBL_LOGO_URL);
    }

    const bannerUrl = await resolveBannerUrl({
      event,
      supabaseUrl,
      supabaseServiceRoleKey,
    });

    return imageResponse(bannerUrl || STUMBL_LOGO_URL);
  },
};
