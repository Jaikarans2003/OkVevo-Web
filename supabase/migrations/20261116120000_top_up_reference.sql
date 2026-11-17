-- Additional % denominator: balance right after the most recent top-up grant.
-- Display = flooredPct(top_up_balance, top_up_reference), capped at 100%.
alter table billing_accounts
  add column if not exists top_up_reference integer not null default 0
  check (top_up_reference >= 0);

-- Existing wallets: treat current leftover as a full bar until the next top-up.
update billing_accounts
set top_up_reference = top_up_balance
where top_up_reference = 0 and top_up_balance > 0;
