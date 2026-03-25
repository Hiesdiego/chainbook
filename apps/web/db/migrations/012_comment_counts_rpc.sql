-- ============================================================
-- CHAINBOOK - Comment count fallback RPC
-- Run after 011.
-- ============================================================

create or replace function get_comment_counts(p_post_ids text[])
returns table (post_id text, comment_count int)
language sql stable as $$
  select c.post_id::text, count(*)::int as comment_count
  from comments c
  where c.post_id::text = any(p_post_ids)
  group by c.post_id;
$$;
