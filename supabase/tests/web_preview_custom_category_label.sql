-- Catalog/data reads only. Run as the existing migration role inside BEGIN READ ONLY.
-- The CLI's restricted --read-only role lacks this RPC's existing EXECUTE grant;
-- do not expand permissions merely to run a test.
WITH public_samples AS MATERIALIZED (
  SELECT id, custom_category_label FROM public.events
  WHERE visibility='public' AND moderation_status='approved' AND deleted_at IS NULL
  ORDER BY id LIMIT 10
), private_samples AS MATERIALIZED (
  SELECT id FROM public.events WHERE visibility='private' LIMIT 10
), example AS (
  SELECT public.get_event_web_preview('5aa7e358-0268-42f4-b6ea-9671aa9bf560',NULL) AS payload
)
SELECT jsonb_build_object(
  'permissions_preserved', has_function_privilege('anon','public.get_event_web_preview(uuid,text)','EXECUTE')
    AND has_function_privilege('authenticated','public.get_event_web_preview(uuid,text)','EXECUTE'),
  'public_labels_match', (SELECT count(*)>0 FROM public_samples) AND NOT EXISTS (
    SELECT 1 FROM public_samples s WHERE public.get_event_web_preview(s.id,NULL) IS NULL
      OR NOT (public.get_event_web_preview(s.id,NULL) ? 'custom_category_label')
      OR public.get_event_web_preview(s.id,NULL)->>'custom_category_label' IS DISTINCT FROM s.custom_category_label
  ),
  'private_without_invite_denied', (SELECT count(*)>0 FROM private_samples) AND NOT EXISTS (
    SELECT 1 FROM private_samples s WHERE public.get_event_web_preview(s.id,NULL) IS NOT NULL
  ),
  'private_invalid_invite_denied', NOT EXISTS (
    SELECT 1 FROM private_samples s WHERE public.get_event_web_preview(s.id,'invalid-regression-token') IS NOT NULL
  ),
  'missing_invite_denied', public.get_event_web_preview(NULL,NULL) IS NULL,
  'invalid_token_only_denied', public.get_event_web_preview(NULL,'invalid-regression-token') IS NULL,
  'example_label_verified', (SELECT payload->>'custom_category_label'='Baby Shower' FROM example),
  'example_free_verified', (SELECT payload->'is_paid'='false'::jsonb FROM example),
  'example_selected_key_preserved', (SELECT payload->'display_pills'='["custom"]'::jsonb FROM example),
  'migration_recorded', EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261121034357')
) AS checks;
