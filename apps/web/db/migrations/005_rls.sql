-- ============================================================
-- CHAINBOOK - RLS Policies (Privy auth)
-- Run after 004.
-- ============================================================

alter table wallets enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table comments enable row level security;
alter table tracked_entities enable row level security;
alter table notifications enable row level security;
alter table alert_subscriptions enable row level security;
alter table trending_entities enable row level security;

create policy "Public wallets read"
  on wallets for select using (true);

create policy "Public posts read"
  on posts for select using (true);

create policy "Public trending read"
  on trending_entities for select using (true);

create policy "Public follows read"
  on follows for select using (true);

create policy "Public comments read"
  on comments for select using (true);

create policy "Service role full access on wallets"
  on wallets for all using (auth.role() = 'service_role');

create policy "Service role full access on posts"
  on posts for all using (auth.role() = 'service_role');

create policy "Service role full access on follows"
  on follows for all using (auth.role() = 'service_role');

create policy "Service role full access on trending"
  on trending_entities for all using (auth.role() = 'service_role');

create policy "Service role full access on notifications"
  on notifications for all using (auth.role() = 'service_role');

create policy "Service role full access on tracked_entities"
  on tracked_entities for all using (auth.role() = 'service_role');

create policy "Service role full access on alert_subscriptions"
  on alert_subscriptions for all using (auth.role() = 'service_role');

create policy "Service role full access on comments"
  on comments for all using (auth.role() = 'service_role');

drop policy if exists "Users manage own follows" on follows;
drop policy if exists "Users manage own comments" on comments;
drop policy if exists "Users manage own tracked entities" on tracked_entities;
drop policy if exists "Users read own notifications" on notifications;
drop policy if exists "Users update own notifications" on notifications;
drop policy if exists "Users manage own alert subscriptions" on alert_subscriptions;

drop policy if exists "Public follows write" on follows;
drop policy if exists "Public follows delete" on follows;
drop policy if exists "Public comments write" on comments;
drop policy if exists "Public tracked entities write" on tracked_entities;
drop policy if exists "Public tracked entities delete" on tracked_entities;
drop policy if exists "Public notifications read" on notifications;
drop policy if exists "Public notifications update" on notifications;
drop policy if exists "Public alert subscriptions write" on alert_subscriptions;
drop policy if exists "Public alert subscriptions delete" on alert_subscriptions;

create policy "Public follows write"
  on follows for insert with check (true);

create policy "Public follows delete"
  on follows for delete using (true);

create policy "Public comments write"
  on comments for insert with check (true);

create policy "Public tracked entities write"
  on tracked_entities for insert with check (true);

create policy "Public tracked entities delete"
  on tracked_entities for delete using (true);

create policy "Public notifications read"
  on notifications for select using (true);

create policy "Public notifications update"
  on notifications for update using (true);

create policy "Public alert subscriptions write"
  on alert_subscriptions for insert with check (true);

create policy "Public alert subscriptions delete"
  on alert_subscriptions for delete using (true);
