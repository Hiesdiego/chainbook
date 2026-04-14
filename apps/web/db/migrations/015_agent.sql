-- ============================================================
-- CHAINBOOK - Agent: AGENT_INSIGHT post type + agent post flag
-- Run after 014.
-- ============================================================

-- 1. Drop the existing type check constraint on posts
alter table posts
  drop constraint if exists posts_type_check;

-- 2. Re-add it with AGENT_INSIGHT included
alter table posts
  add constraint posts_type_check
  check (type in (
    'SWAP', 'TRANSFER', 'MINT', 'DAO_VOTE',
    'LIQUIDITY_ADD', 'LIQUIDITY_REMOVE',
    'CONTRACT_DEPLOY', 'NFT_TRADE',
    'AGENT_INSIGHT'
  ));

-- 3. Add is_agent_post flag (defaults false — backward compatible)
alter table posts
  add column if not exists is_agent_post boolean not null default false;

create index if not exists posts_is_agent_post_idx
  on posts(is_agent_post)
  where is_agent_post = true;

-- 4. Agent wallet row (static agent identity in wallets table)
--    Replace the address below with your AGENT_WALLET_ADDRESS env value
--    if you want it pre-seeded; the API route upserts it automatically.
-- insert into wallets (address, label, tier, updated_at)
-- values ('0x000000000000000000000000chainbookai', 'Chainbook AI', 'WHALE', now())
-- on conflict (address) do nothing;

-- 5. RLS: agent insight posts are publicly readable (already covered by
--    "Public posts read" policy) and writable only by service role
--    (already covered by "Service role full access on posts" policy).
--    No new policies needed.