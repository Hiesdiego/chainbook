-- ============================================================
-- CHAINBOOK - Sync post comment counts via trigger
-- Run after 009.
-- ============================================================

create or replace function sync_comment_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update posts
      set comment_count = comment_count + 1
    where id = new.post_id;
  elsif TG_OP = 'DELETE' then
    update posts
      set comment_count = greatest(0, comment_count - 1)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_sync_counts on comments;
create trigger comments_sync_counts
  after insert or delete on comments
  for each row execute procedure sync_comment_count();

-- Backfill existing rows to ensure counts are correct (safe to re-run).
update posts
set comment_count = (
  select count(*)
  from comments
  where comments.post_id = posts.id
);
