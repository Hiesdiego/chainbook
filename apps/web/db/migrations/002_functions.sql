-- ============================================================
-- CHAINBOOK — Helper Functions
-- Run this in Supabase SQL Editor AFTER migration.sql
-- ============================================================

-- ─── Increment wallet stats atomically ───────────────────────
create or replace function increment_wallet_stats(
  p_address text,
  p_volume_usd numeric
)
returns void language plpgsql security definer as $$
begin
  insert into wallets (address, volume_usd, activity_count, updated_at)
  values (p_address, p_volume_usd, 1, now())
  on conflict (address) do update
    set volume_usd     = wallets.volume_usd + excluded.volume_usd,
        activity_count = wallets.activity_count + 1,
        updated_at     = now();
end;
$$;

-- ─── Update wallet reputation score and tier ─────────────────
create or replace function update_wallet_reputation(
  p_address       text,
  p_volume_delta  numeric,
  p_activity_delta int
)
returns void language plpgsql security definer as $$
declare
  v_volume   numeric;
  v_activity int;
  v_score    numeric;
  v_tier     text;
begin
  -- Upsert wallet first
  insert into wallets (address, volume_usd, activity_count, updated_at)
  values (p_address, p_volume_delta, p_activity_delta, now())
  on conflict (address) do update
    set volume_usd     = wallets.volume_usd + p_volume_delta,
        activity_count = wallets.activity_count + p_activity_delta,
        updated_at     = now()
  returning volume_usd, activity_count into v_volume, v_activity;

  -- Score: volume contributes 70%, activity 30%
  v_score := (v_volume / 100) + (v_activity * 10);

  -- Determine tier
  v_tier := case
    when v_score >= 1000000 then 'WHALE'
    when v_score >= 100000  then 'SHARK'
    when v_score >= 10000   then 'FISH'
    when v_score >= 1000    then 'CRAB'
    else 'SHRIMP'
  end;

  update wallets
    set reputation_score = v_score,
        tier             = v_tier
  where address = p_address;
end;
$$;

-- ─── Increment post like count ────────────────────────────────
create or replace function increment_post_likes(p_post_id uuid)
returns void language plpgsql security definer as $$
begin
  update posts set like_count = like_count + 1 where id = p_post_id;
end;
$$;

create or replace function decrement_post_likes(p_post_id uuid)
returns void language plpgsql security definer as $$
begin
  update posts set like_count = greatest(0, like_count - 1) where id = p_post_id;
end;
$$;

-- ─── Increment post comment count ────────────────────────────
create or replace function increment_post_comments(p_post_id uuid)
returns void language plpgsql security definer as $$
begin
  update posts set comment_count = comment_count + 1 where id = p_post_id;
end;
$$;

-- ─── Sync follower counts ─────────────────────────────────────
create or replace function sync_follower_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update wallets set follower_count  = follower_count + 1  where address = new.subject;
    update wallets set following_count = following_count + 1 where address = new.follower;
  elsif TG_OP = 'DELETE' then
    update wallets set follower_count  = greatest(0, follower_count - 1)  where address = old.subject;
    update wallets set following_count = greatest(0, following_count - 1) where address = old.follower;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_sync_counts on follows;
create trigger follows_sync_counts
  after insert or delete on follows
  for each row execute procedure sync_follower_count();