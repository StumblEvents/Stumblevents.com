-- Catalog-only verification; execute with the CLI's --read-only flag.
-- Never invoke the analytics RPC as a production smoke test without approval.
select jsonb_build_object(
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'settings', p.proconfig,
      'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_execute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'definition', pg_get_functiondef(p.oid)
    ))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_event_web_preview', 'track_web_calendar_interest')
  ),
  'deduplication_index', (
    select indexdef from pg_indexes
    where schemaname = 'public'
      and indexname = 'event_analytics_events_calendar_interest_dedupe_idx'
  ),
  'analytics_constraint', (
    select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.event_analytics_events'::regclass
      and conname = 'event_analytics_events_event_type_check'
  ),
  'migrations', (
    select jsonb_agg(version) from supabase_migrations.schema_migrations
    where version in ('20261012090000', '20261012173000')
  )
) as verification;
