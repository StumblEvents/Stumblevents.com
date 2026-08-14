import {
  EVENT_IMAGE_BUCKET,
  buildPublicStorageUrl,
  firstRow,
  normalizeEvent,
} from "./_preview.js";

export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9._~-]{8,512}$/;

export function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function fetchPublicEvent({ supabaseUrl, supabaseAnonKey, eventId }) {
  const params = new URLSearchParams({
    select:
      "id,title,description,start_time,end_time,timezone,banner_image_path,image_url,visibility",
    id: `eq.${eventId}`,
    visibility: "eq.public",
    limit: "1",
  });

  const response = await fetch(
    `${supabaseUrl}/rest/v1/events?${params.toString()}`,
    {
      headers: supabaseHeaders(supabaseAnonKey),
    }
  );

  if (!response.ok) {
    console.error("Supabase public event lookup failed:", response.status);
    return null;
  }

  const events = await response.json().catch(() => []);
  return normalizeEvent(firstRow(events));
}

export async function resolveInvite({ supabaseUrl, supabaseAnonKey, inviteToken }) {
  if (!inviteToken || !INVITE_TOKEN_PATTERN.test(inviteToken)) {
    return null;
  }

  const argumentNames = [
    "invite_token",
    "token",
    "p_invite_token",
    "p_token",
  ];

  let response = null;

  for (const argumentName of argumentNames) {
    response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_event_invite_preview`,
      {
        method: "POST",
        headers: supabaseHeaders(supabaseAnonKey),
        body: JSON.stringify({ [argumentName]: inviteToken }),
      }
    );

    if (response.ok) break;

    if (![400, 404].includes(response.status)) {
      console.error("Supabase invite preview lookup failed:", response.status);
      return null;
    }
  }

  if (!response?.ok) {
    console.error("Supabase invite preview lookup failed:", response.status);
    return null;
  }

  const payload = await response.json().catch(() => null);
  return normalizeEvent(firstRow(payload));
}

export async function createSignedBannerUrl({
  supabaseUrl,
  supabaseServiceRoleKey,
  bannerImagePath,
}) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !bannerImagePath) {
    return null;
  }

  const encodedPath = String(bannerImagePath)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${EVENT_IMAGE_BUCKET}/${encodedPath}`,
    {
      method: "POST",
      headers: supabaseHeaders(supabaseServiceRoleKey),
      body: JSON.stringify({ expiresIn: 3600 }),
    }
  );

  if (!response.ok) {
    console.error("Supabase banner signing failed:", response.status);
    return null;
  }

  const payload = await response.json().catch(() => null);
  const signedPath = payload?.signedURL || payload?.signedUrl || payload?.signed_url;

  if (!signedPath) return null;
  if (/^https?:\/\//i.test(signedPath)) return signedPath;

  return `${supabaseUrl}/storage/v1${signedPath}`;
}

export async function resolveBannerUrl({
  event,
  supabaseUrl,
  supabaseServiceRoleKey,
}) {
  if (!event) return null;

  if (event.image_url && /^https?:\/\//i.test(event.image_url)) {
    return event.image_url;
  }

  if (!event.banner_image_path) return null;

  const signedUrl = await createSignedBannerUrl({
    supabaseUrl,
    supabaseServiceRoleKey,
    bannerImagePath: event.banner_image_path,
  });

  return signedUrl || buildPublicStorageUrl(supabaseUrl, event.banner_image_path);
}
