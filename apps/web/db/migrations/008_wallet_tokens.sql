-- ============================================================
-- CHAINBOOK - Wallet tokens + whale balance logic
-- Run after 007.
-- ============================================================

-- Track token holdings per wallet
create table if not exists wallet_token_holdings (
  wallet_address text not null,
  token_address  text not null,
  balance_raw    numeric,
  decimals       int,
  balance_usd    numeric,
  updated_at     timestamptz not null default now(),
  primary key (wallet_address, token_address)
);

create index if not exists wallet_token_holdings_wallet_idx
  on wallet_token_holdings(wallet_address);
create index if not exists wallet_token_holdings_token_idx
  on wallet_token_holdings(token_address);

-- Track tokens minted or created by a wallet
create table if not exists minted_tokens (
  wallet_address text not null,
  token_address  text not null,
  kind           text not null check (kind in ('CREATED', 'MINTED')),
  tx_hash        text not null,
  created_at     timestamptz not null default now(),
  primary key (wallet_address, token_address, kind, tx_hash)
);

create index if not exists minted_tokens_wallet_idx
  on minted_tokens(wallet_address);

-- Wallet balance USD (for whale tiering)
alter table if exists wallets
  add column if not exists wallet_balance_usd numeric not null default 0;

-- Update reputation tier logic to consider balance/volume thresholds
create or replace function update_wallet_reputation(
  p_address       text,
  p_volume_delta  numeric,
  p_activity_delta int
)
returns void language plpgsql security definer as $$
declare
  v_volume   numeric;
  v_activity int;
  v_balance  numeric;
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
  returning volume_usd, activity_count, wallet_balance_usd
    into v_volume, v_activity, v_balance;

  -- Score: volume contributes 70%, activity 30%
  v_score := (v_volume / 100) + (v_activity * 10);

  -- Determine tier: whale if volume or balance exceeds 100k
  v_tier := case
    when v_volume >= 100000 or coalesce(v_balance, 0) >= 100000 then 'WHALE'
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

-- RLS
alter table wallet_token_holdings enable row level security;
alter table minted_tokens enable row level security;

create policy "Public wallet token holdings read"
  on wallet_token_holdings for select using (true);

create policy "Public minted tokens read"
  on minted_tokens for select using (true);

create policy "Service role full access on wallet token holdings"
  on wallet_token_holdings for all using (auth.role() = 'service_role');

create policy "Service role full access on minted tokens"
  on minted_tokens for all using (auth.role() = 'service_role');
