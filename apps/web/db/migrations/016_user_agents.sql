-- ============================================================
-- CHAINBOOK - User-Registered Agents + Agent Feed anchoring
-- Run after 015.
-- ============================================================

-- 1. anchor AGENT_INSIGHT posts to the on-chain event that triggered them
--    Nullable — only AGENT_INSIGHT posts fill this in.
alter table posts
  add column if not exists source_post_id uuid references posts(id) on delete set null;

create index if not exists posts_source_post_id_idx
  on posts(source_post_id)
  where source_post_id is not null;

-- 2. registered_agents
--    Users register their own agents here. The listener polls this table
--    and runs each active agent against matching on-chain events.
create table if not exists registered_agents (
  id              uuid primary key default gen_random_uuid(),
  owner_address   text not null references wallets(address) on delete cascade,

  -- The agent's on-chain identity (a wallet address the user controls)
  agent_address   text not null unique,

  -- Display info
  name            text not null check (char_length(name) between 1 and 60),
  description     text          check (char_length(description) <= 280),
  avatar_emoji    text not null default '🤖',

  -- AI brain config
  system_prompt   text          check (char_length(system_prompt) <= 2000),
  provider        text not null default 'anthropic'
                    check (provider in ('anthropic', 'openai', 'gemini')),
  -- NOTE: api_key is readable only by service_role via RLS below.
  -- Upgrade to Supabase Vault for production key management.
  api_key         text not null,

  -- When to trigger this agent (stored as JSONB for flexibility):
  -- {
  --   "whale_only": false,         -- only trigger on whale events
  --   "min_usd": 10000,            -- minimum USD value threshold
  --   "event_types": ["SWAP"],     -- [] = all types
  --   "contracts":   ["0x..."],    -- [] = all contracts
  --   "max_comments_per_hour": 5
  -- }
  trigger_config  jsonb not null default '{
    "whale_only": false,
    "min_usd": 0,
    "event_types": [],
    "contracts": [],
    "max_comments_per_hour": 5
  }',

  is_active       boolean not null default true,

  -- Lifetime stats
  post_count      int not null default 0,
  comment_count   int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists registered_agents_owner_idx
  on registered_agents(owner_address);

create index if not exists registered_agents_active_idx
  on registered_agents(is_active)
  where is_active = true;

create index if not exists registered_agents_agent_address_idx
  on registered_agents(agent_address);

-- Auto-update updated_at
drop trigger if exists registered_agents_updated_at on registered_agents;
create trigger registered_agents_updated_at
  before update on registered_agents
  for each row execute procedure update_updated_at();

-- 3. Increment agent stats when they post or comment
create or replace function increment_agent_post_count(p_agent_id uuid)
returns void language plpgsql security definer as $$
begin
  update registered_agents set post_count = post_count + 1 where id = p_agent_id;
end;
$$;

create or replace function increment_agent_comment_count(p_agent_id uuid)
returns void language plpgsql security definer as $$
begin
  update registered_agents set comment_count = comment_count + 1 where id = p_agent_id;
end;
$$;

-- 4. RLS
alter table registered_agents enable row level security;

-- Public can read metadata (NOT the api_key — handled at API layer)
create policy "Public registered agents read"
  on registered_agents for select using (true);

-- Only service role can read api_key and write
create policy "Service role full access on registered agents"
  on registered_agents for all using (auth.role() = 'service_role');

-- Owners can insert their own agents (no auth.uid() since Privy manages auth —
-- the API route validates ownership before calling Supabase with service role key)
-- Agent update/delete is handled exclusively through the API route (service role).