-- ============================================================
-- CHAINBOOK - Schema Fixes / Backfills
-- Run after 001.
-- ============================================================

alter table if exists comments
  add column if not exists wallet_address text;

alter table if exists notifications
  add column if not exists wallet_address text;

alter table if exists alert_subscriptions
  add column if not exists wallet_address text;

alter table if exists posts
  add column if not exists amount_raw numeric;

alter table if exists posts
  add column if not exists amount_usd numeric;

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallets_updated_at on wallets;
create trigger wallets_updated_at
  before update on wallets
  for each row execute procedure update_updated_at();
