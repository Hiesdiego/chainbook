-- ============================================================
-- CHAINBOOK - Reactivity spotlight + showcase tables
-- Run after 012.
-- ============================================================

create table if not exists reactivity_spotlight_posts (
  post_id     uuid primary key references posts(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists reactivity_spotlight_posts_created_at_idx
  on reactivity_spotlight_posts(created_at desc);

create table if not exists reactivity_showcase_events (
  id             uuid primary key default gen_random_uuid(),
  tx_hash        text not null unique,
  event_contract text not null,
  topic0         text not null,
  block_number   bigint not null,
  created_at     timestamptz not null default now()
);

create index if not exists reactivity_showcase_events_created_at_idx
  on reactivity_showcase_events(created_at desc);

alter table reactivity_spotlight_posts enable row level security;
alter table reactivity_showcase_events enable row level security;

drop policy if exists "Public reactivity spotlight read" on reactivity_spotlight_posts;
drop policy if exists "Service role full access on reactivity spotlight" on reactivity_spotlight_posts;
drop policy if exists "Public reactivity showcase read" on reactivity_showcase_events;
drop policy if exists "Service role full access on reactivity showcase" on reactivity_showcase_events;

create policy "Public reactivity spotlight read"
  on reactivity_spotlight_posts for select using (true);

create policy "Service role full access on reactivity spotlight"
  on reactivity_spotlight_posts for all using (auth.role() = 'service_role');

create policy "Public reactivity showcase read"
  on reactivity_showcase_events for select using (true);

create policy "Service role full access on reactivity showcase"
  on reactivity_showcase_events for all using (auth.role() = 'service_role');
