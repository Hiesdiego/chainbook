-- ============================================================
-- CHAINBOOK - Posts Column Backfill
-- Run after 001 and before indexes.
-- ============================================================

alter table if exists posts
  add column if not exists post_id_hash text;

alter table if exists posts
  add column if not exists type text;

alter table if exists posts
  add column if not exists wallet_address text;

alter table if exists posts
  add column if not exists contract_address text;

alter table if exists posts
  add column if not exists token_in text;

alter table if exists posts
  add column if not exists token_out text;

alter table if exists posts
  add column if not exists amount_raw numeric;

alter table if exists posts
  add column if not exists amount_usd numeric;

alter table if exists posts
  add column if not exists tx_hash text;

alter table if exists posts
  add column if not exists block_number bigint;

alter table if exists posts
  add column if not exists metadata jsonb;

alter table if exists posts
  add column if not exists like_count int;

alter table if exists posts
  add column if not exists comment_count int;

alter table if exists posts
  add column if not exists is_whale_alert boolean;

alter table if exists posts
  add column if not exists created_at timestamptz;

alter table if exists posts
  add column if not exists heading text;

update posts set heading = '' where heading is null;

alter table if exists posts
  alter column heading set default '';

alter table if exists posts
  add column if not exists content text;

update posts set content = '' where content is null;

alter table if exists posts
  alter column content set default '';

create unique index if not exists posts_post_id_hash_uidx on posts(post_id_hash);

-- Backfill defaults where needed
update posts set metadata = '{}' where metadata is null;
update posts set like_count = 0 where like_count is null;
update posts set comment_count = 0 where comment_count is null;
update posts set is_whale_alert = false where is_whale_alert is null;
update posts set created_at = now() where created_at is null;

-- Ensure relationship between posts.wallet_address and wallets.address
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_wallet_address_fkey'
  ) then
    alter table posts
      add constraint posts_wallet_address_fkey
      foreign key (wallet_address)
      references wallets(address)
      on delete set null;
  end if;
end $$;
