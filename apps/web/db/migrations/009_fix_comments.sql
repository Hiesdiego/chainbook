-- ============================================================
-- CHAINBOOK - Fix comments table: drop user_id NOT NULL constraint
-- Run after 008.
-- This column was added externally and conflicts with Privy-based auth
-- (which uses wallet_address as the primary identifier).
-- ============================================================

-- Make user_id nullable if it exists (safe: no-op if already nullable)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'comments' and column_name = 'user_id'
  ) then
    alter table comments alter column user_id drop not null;
  end if;
end;
$$;
