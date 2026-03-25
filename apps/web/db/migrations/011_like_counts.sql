-- ============================================================
-- CHAINBOOK - Harden like count updates
-- Run after 010.
-- ============================================================

create or replace function increment_post_likes(p_post_id uuid)
returns void language plpgsql security definer as $$
begin
  update posts
    set like_count = coalesce(like_count, 0) + 1
  where id = p_post_id;
end;
$$;

create or replace function decrement_post_likes(p_post_id uuid)
returns void language plpgsql security definer as $$
begin
  update posts
    set like_count = greatest(0, coalesce(like_count, 0) - 1)
  where id = p_post_id;
end;
$$;
