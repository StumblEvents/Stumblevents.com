import {
  UUID_PATTERN,
  htmlResponse,
  renderEventPreview,
  renderGenericPreview,
} from "./_preview.js";
import { fetchPublicEvent, resolveInvite } from "./_supabase.js";

function eventIdMatchesInvite(eventId, invitedEvent) {
  if (!eventId) return true;
  return invitedEvent?.id?.toLowerCase() === eventId.toLowerCase();
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("id");
    const inviteToken = url.searchParams.get("invite") || url.searchParams.get("token");
    const legacyInvite = !eventId && Boolean(inviteToken);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase event preview environment is not configured.");
      return htmlResponse(renderGenericPreview());
    }

    if (eventId && !UUID_PATTERN.test(eventId)) {
      return htmlResponse(renderGenericPreview());
    }

    if (inviteToken) {
      const invitedEvent = await resolveInvite({
        supabaseUrl,
        supabaseAnonKey,
        inviteToken,
      });

      if (!eventIdMatchesInvite(eventId, invitedEvent)) {
        return htmlResponse(renderGenericPreview());
      }

      if (!invitedEvent) {
        return htmlResponse(renderGenericPreview());
      }

      return htmlResponse(
        renderEventPreview({
          event: invitedEvent,
          supabaseUrl,
          inviteToken,
          legacyInvite,
        })
      );
    }

    if (!eventId) {
      return htmlResponse(renderGenericPreview());
    }

    const publicEvent = await fetchPublicEvent({
      supabaseUrl,
      supabaseAnonKey,
      eventId,
    });

    if (!publicEvent) {
      return htmlResponse(renderGenericPreview());
    }

    return htmlResponse(
      renderEventPreview({
        event: publicEvent,
        supabaseUrl,
      })
    );
  },
};
