-- ============================================================
-- CHAINBOOK - Backfill reactivity source metadata
-- Run after 013.
-- ============================================================

-- Mark historical rows that were created before source tagging was added.
update posts
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{reactivity_source}',
  '"legacy_unknown"',
  true
)
where metadata is null
   or not (coalesce(metadata, '{}'::jsonb) ? 'reactivity_source');
