-- ============================================================
-- CHAINBOOK - Indexes
-- Run after 003.
-- ============================================================

create index if not exists wallets_tier_idx on wallets(tier);
create index if not exists wallets_reputation_idx on wallets(reputation_score desc);
create index if not exists wallets_volume_idx on wallets(volume_usd desc);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'wallet_address'
  ) then
    execute 'create index if not exists posts_wallet_idx on posts(wallet_address)';
  end if;
end $$;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'type'
  ) then
    execute 'create index if not exists posts_type_idx on posts(type)';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'is_whale_alert'
  ) then
    execute 'create index if not exists posts_whale_idx on posts(is_whale_alert) where is_whale_alert = true';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'created_at'
  ) then
    execute 'create index if not exists posts_created_at_idx on posts(created_at desc)';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'contract_address'
  ) then
    execute 'create index if not exists posts_contract_idx on posts(contract_address)';
  end if;
end $$;

create index if not exists follows_subject_idx on follows(subject);
create index if not exists follows_follower_idx on follows(follower);

create index if not exists tracked_entities_tracker_idx on tracked_entities(tracker);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comments'
      and column_name = 'post_id'
  ) then
    execute 'create index if not exists comments_post_idx on comments(post_id)';
  end if;
end $$;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comments'
      and column_name = 'wallet_address'
  ) then
    execute 'create index if not exists comments_wallet_idx on comments(wallet_address)';
  end if;
end $$;

create index if not exists trending_rank_idx on trending_entities(rank asc);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'wallet_address'
  ) then
    execute 'create index if not exists notifications_wallet_idx on notifications(wallet_address, read)';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'alert_subscriptions'
      and column_name = 'wallet_address'
  ) then
    execute 'create index if not exists alert_subs_wallet_idx on alert_subscriptions(wallet_address)';
  end if;
end $$;
create index if not exists alert_subs_target_idx on alert_subscriptions(target_address);
