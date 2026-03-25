-- ============================================================
-- CHAINBOOK - Features: significance + token metadata + alerts
-- Run after 006.
-- ============================================================

-- Token metadata cache
create table if not exists token_metadata (
  address     text primary key,
  name        text,
  symbol      text,
  decimals    int,
  is_nft      boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists token_metadata_symbol_idx on token_metadata(symbol);
create index if not exists token_metadata_updated_at_idx on token_metadata(updated_at desc);

-- Significance scoring fields
alter table if exists posts
  add column if not exists significance_score numeric;

alter table if exists posts
  add column if not exists is_significant boolean not null default false;

-- Backfill significance scores for existing posts
update posts
set significance_score =
  coalesce(log(10, amount_usd + 1) * 10, 0) +
  case type
    when 'SWAP' then 8
    when 'TRANSFER' then 4
    when 'MINT' then 3
    when 'DAO_VOTE' then 5
    when 'LIQUIDITY_ADD' then 6
    when 'LIQUIDITY_REMOVE' then 6
    when 'NFT_TRADE' then 7
    when 'CONTRACT_DEPLOY' then 6
    else 0
  end +
  case when is_whale_alert then 20 else 0 end
where significance_score is null;

update posts
set is_significant =
  (coalesce(amount_usd, 0) >= 1000)
  or (coalesce(significance_score, 0) >= 20)
  or (is_whale_alert = true)
where is_significant = false or is_significant is null;

create index if not exists posts_significance_score_idx on posts(significance_score desc);
create index if not exists posts_is_significant_idx on posts(is_significant);

-- Expand notification types for alerts/watchlists
alter table if exists notifications
  drop constraint if exists notifications_type_check;

alter table if exists notifications
  add constraint notifications_type_check
  check (type in (
    'WHALE_ALERT',
    'FOLLOWED_WALLET_ACTIVITY',
    'TRACKED_CONTRACT',
    'TRACKED_WALLET',
    'ALERT_ACTIVITY',
    'ALERT_LARGE_TRADE'
  ));

-- RLS for token metadata
alter table token_metadata enable row level security;

create policy "Public token metadata read"
  on token_metadata for select using (true);

create policy "Service role full access on token metadata"
  on token_metadata for all using (auth.role() = 'service_role');
