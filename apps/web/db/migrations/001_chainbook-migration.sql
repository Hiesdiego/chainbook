-- ============================================================
-- CHAINBOOK - Base Tables
-- Run first.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

create table if not exists wallets (
  address           text primary key,
  ens_name          text,
  label             text,
  tier              text not null default 'SHRIMP'
                      check (tier in ('WHALE', 'SHARK', 'FISH', 'CRAB', 'SHRIMP')),
  reputation_score  numeric not null default 0,
  volume_usd        numeric not null default 0,
  follower_count    int not null default 0,
  following_count   int not null default 0,
  nft_count         int not null default 0,
  activity_count    int not null default 0,
  first_seen_at     timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists posts (
  id               uuid primary key default gen_random_uuid(),
  post_id_hash     text unique not null,
  type             text not null
                     check (type in (
                       'SWAP', 'TRANSFER', 'MINT', 'DAO_VOTE',
                       'LIQUIDITY_ADD', 'LIQUIDITY_REMOVE',
                       'CONTRACT_DEPLOY', 'NFT_TRADE'
                     )),
  wallet_address   text references wallets(address) on delete set null,
  contract_address text,
  token_in         text,
  token_out        text,
  amount_raw       numeric,
  amount_usd       numeric,
  tx_hash          text not null,
  block_number     bigint not null,
  metadata         jsonb not null default '{}',
  like_count       int not null default 0,
  comment_count    int not null default 0,
  is_whale_alert   boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists follows (
  follower    text not null references wallets(address) on delete cascade,
  subject     text not null references wallets(address) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower, subject)
);

create table if not exists tracked_entities (
  tracker        text not null,
  entity_address text not null,
  entity_type    text not null
                   check (entity_type in ('WALLET', 'CONTRACT', 'TOKEN', 'NFT')),
  created_at     timestamptz not null default now(),
  primary key (tracker, entity_address)
);

create table if not exists comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references posts(id) on delete cascade,
  wallet_address text not null,
  content        text not null check (char_length(content) <= 500),
  created_at     timestamptz not null default now()
);

create table if not exists trending_entities (
  entity_address  text primary key,
  entity_type     text not null
                    check (entity_type in ('WALLET', 'CONTRACT', 'TOKEN', 'NFT')),
  entity_name     text,
  event_count     int not null default 0,
  unique_wallets  int not null default 0,
  velocity        numeric not null default 0,
  rank            int not null default 0,
  updated_at      timestamptz not null default now()
);

create table if not exists notifications (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  post_id        uuid references posts(id) on delete cascade,
  type           text not null
                   check (type in (
                     'WHALE_ALERT',
                     'FOLLOWED_WALLET_ACTIVITY',
                     'TRACKED_CONTRACT'
                   )),
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists alert_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  target_address text not null,
  alert_type     text not null
                   check (alert_type in ('WHALE_MOVE', 'ANY_ACTIVITY', 'LARGE_TRADE')),
  threshold_usd  numeric,
  created_at     timestamptz not null default now(),
  unique (wallet_address, target_address, alert_type)
);
