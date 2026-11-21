-- PR 2b-a: sponsored bucket, allocation lot stamp, audit_log, hold column.
-- Forward-only. RLS on, no policies, revoke anon/authenticated.

-- --- billing_accounts: sponsored ---
alter table public.billing_accounts
  add column if not exists sponsored_balance integer not null default 0,
  add column if not exists sponsored_reference integer not null default 0;

alter table public.billing_accounts
  drop constraint if exists billing_accounts_top_up_balance_check;

alter table public.billing_accounts
  drop constraint if exists billing_accounts_allocation_balance_check;

-- Every account: allocation and top_up never below zero.
alter table public.billing_accounts
  add constraint billing_accounts_allocation_balance_check
    check (allocation_balance >= 0);

alter table public.billing_accounts
  add constraint billing_accounts_top_up_balance_check
    check (top_up_balance >= 0);

-- Sponsored may go negative only on prepaid (child) wallets.
alter table public.billing_accounts
  drop constraint if exists billing_accounts_sponsored_balance_check;

alter table public.billing_accounts
  add constraint billing_accounts_sponsored_balance_check
    check (access_mode = 'prepaid' or sponsored_balance >= 0);

-- --- credit_transactions: allocation lot stamp + sponsored bucket allowed ---
alter table public.credit_transactions
  add column if not exists razorpay_subscription_id text;

-- bucket check may already allow free text; ensure sponsored is usable (no enum).
comment on column public.credit_transactions.razorpay_subscription_id is
  'Allocation lot stamp: plan-grant rows keyed by Razorpay subscription id for SET renewals.';

-- --- gateway_jobs: third hold bucket ---
alter table public.gateway_jobs
  add column if not exists held_sponsored integer;

-- --- audit_log (Leave/Remove in 2b-a; invites/roles in 2b-b) ---
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  actor_user_id text not null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx
  on public.audit_log (org_id, created_at);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant all on table public.audit_log to service_role;
