-- Add one presentation field after the existing authorization checks.
-- Captured from the current function; owner, ACL, arguments and all other fields remain unchanged.
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('public.get_event_web_preview(uuid,text)'::regprocedure)) <> '830636ace23079101a3e43bafdbbb0b2' THEN
    RAISE EXCEPTION 'Event preview function changed since review; stop and re-review';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.get_event_web_preview(p_event_id uuid DEFAULT NULL::uuid, p_invite_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event public.events%rowtype;
  v_normalized_token text := btrim(coalesce(p_invite_token, ''));
  v_token_hash text;
  v_private_invite_valid boolean := false;
begin
  if p_event_id is null and v_normalized_token = '' then
    return null;
  end if;

  if v_normalized_token <> '' then
    v_token_hash := encode(extensions.digest(v_normalized_token, 'sha256'), 'hex');
  end if;

  if p_event_id is not null then
    select e.*
    into v_event
    from public.events as e
    where e.id = p_event_id
      and e.deleted_at is null
    limit 1;
  else
    select e.*
    into v_event
    from public.event_invite_links as link
    join public.events as e on e.id = link.event_id
    where link.token_hash = v_token_hash
      and link.revoked_at is null
      and (link.expires_at is null or link.expires_at > now())
      and (link.max_uses is null or link.use_count < link.max_uses)
      and e.deleted_at is null
      and e.visibility = 'private'
      and e.moderation_status = 'approved'
    limit 1;
  end if;

  if v_event.id is null or v_event.moderation_status <> 'approved' then
    return null;
  end if;

  if v_event.visibility = 'private' then
    if v_normalized_token = '' then
      return null;
    end if;
    select exists(
      select 1
      from public.event_invite_links as link
      where link.event_id = v_event.id
        and link.token_hash = v_token_hash
        and link.revoked_at is null
        and (link.expires_at is null or link.expires_at > now())
        and (link.max_uses is null or link.use_count < link.max_uses)
    ) into v_private_invite_valid;
    if not v_private_invite_valid then
      return null;
    end if;
  elsif v_event.visibility <> 'public' then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_event.id,
    'visibility', v_event.visibility,
    'title', v_event.title,
    'description', v_event.description,
    'start_time', v_event.start_time,
    'end_time', v_event.end_time,
    'timezone', v_event.timezone,
    'category_name', v_event.category_name,
    'custom_category_label', v_event.custom_category_label,
    'subcategory_name', v_event.subcategory_name,
    'display_pills', coalesce(v_event.display_pills, '[]'::jsonb),
    'banner_image_path', v_event.banner_image_path,
    'image_url', v_event.image_url,
    'venue_name', v_event.venue_name,
    'location_details', v_event.location_details,
    'address', v_event.address,
    'city', v_event.city,
    'state', v_event.state,
    'zip', v_event.zip,
    'latitude', v_event.latitude,
    'longitude', v_event.longitude,
    'parking_notes', v_event.parking_notes,
    'is_paid', v_event.is_paid,
    'ticket_sales_enabled', v_event.ticket_sales_enabled,
    'creator', (
      select jsonb_build_object(
        'display_name', profile.display_name,
        'username', profile.username,
        'avatar_url', profile.avatar_url,
        'is_verified', coalesce(profile.is_verified, false)
          or profile.organization_verification_status = 'verified'
      )
      from public.profiles as profile
      where profile.id = v_event.creator_id
    ),
    'occurrences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', instance.id,
        'start_at', instance.start_at,
        'end_at', instance.end_at,
        'occurrence_date', instance.occurrence_date,
        'title', instance.instance_title
      ) order by instance.start_at)
      from public.event_instances as instance
      where instance.event_id = v_event.id
        and instance.status = 'scheduled'
    ), '[]'::jsonb),
    'schedule_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'title', item.title,
        'activity_date', item.activity_date,
        'start_at', item.start_at,
        'end_at', item.end_at,
        'description', item.description
      ) order by item.activity_date, item.start_at, item.sort_order)
      from public.event_schedule_items as item
      where item.event_id = v_event.id
    ), '[]'::jsonb),
    'ticket_types', case when v_event.is_paid and v_event.ticket_sales_enabled then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ticket.id,
        'name', ticket.name,
        'description', ticket.description,
        'price_cents', ticket.price_cents,
        'currency', ticket.currency,
        'capacity', ticket.capacity
      ) order by ticket.sort_order, ticket.created_at)
      from public.event_ticket_types as ticket
      where ticket.event_id = v_event.id
        and ticket.is_active is true
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$function$;

NOTIFY pgrst, 'reload schema';
