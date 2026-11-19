-- PR 2: organizations, memberships, invitations, join codes, org wallets,
-- transfers/debt ledger types, usage_daily, contact approval columns.
-- Forward-only: no downgrade of account_kind / organizations.kind.

-- ---------------------------------------------------------------------------
-- Hierarchy
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  kind text not null check (kind in ('super_org', 'org')),
  parent_id uuid references public.organizations (id),
  name text not null,
  created_by text references public.users (id),
  created_at timestamptz not null default now(),
  check (kind <> 'super_org' or parent_id is null)
);

create index organizations_parent_id_idx on public.organizations (parent_id);

create table public.memberships (
  org_id uuid not null references public.organizations (id),
  user_id text not null references public.users (id),
  role text not null check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by text references public.users (id),
  revoked_at timestamptz,
  invited_by text references public.users (id),
  created_at timestamptz not null default now()
);

create index invitations_org_id_idx on public.invitations (org_id);

create table public.join_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  code_hash text not null unique,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  expires_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  revoked_at timestamptz,
  created_by text references public.users (id),
  created_at timestamptz not null default now()
);

create index join_codes_org_id_idx on public.join_codes (org_id);

-- users.upgraded_org_id (set once by upgrade / super-org approval)
alter table public.users
  add column if not exists upgraded_org_id uuid unique references public.organizations (id);

-- ---------------------------------------------------------------------------
-- billing_accounts: org ownership + prepaid child orgs
-- ---------------------------------------------------------------------------
alter table public.billing_accounts
  alter column owner_user_id drop not null;

alter table public.billing_accounts
  drop constraint if exists billing_accounts_owner_user_id_key;

alter table public.billing_accounts
  drop constraint if exists billing_accounts_account_kind_check;

alter table public.billing_accounts
  drop constraint if exists billing_accounts_access_mode_check;

alter table public.billing_accounts
  drop constraint if exists billing_accounts_top_up_balance_check;

alter table public.billing_accounts
  add column if not exists owner_org_id uuid references public.organizations (id);

alter table public.billing_accounts
  add constraint billing_accounts_one_owner
    check (num_nonnulls(owner_user_id, owner_org_id) = 1);

alter table public.billing_accounts
  add constraint billing_accounts_account_kind_check
    check (account_kind in ('individual', 'org', 'super_org'));

alter table public.billing_accounts
  add constraint billing_accounts_access_mode_check
    check (access_mode in ('subscription', 'prepaid'));

-- Only prepaid (child org) wallets may go negative on top_up.
alter table public.billing_accounts
  add constraint billing_accounts_top_up_nonneg_unless_prepaid
    check (access_mode = 'prepaid' or top_up_balance >= 0);

-- UNIQUE allows multiple NULLs in Postgres, so org wallets (owner_user_id null)
-- and individual wallets (owner_org_id null) coexist. Keeps ON CONFLICT
-- (owner_user_id) working for ensureUserAndBilling.
alter table public.billing_accounts
  add constraint billing_accounts_owner_user_id_key unique (owner_user_id);

alter table public.billing_accounts
  add constraint billing_accounts_owner_org_id_key unique (owner_org_id);

-- ---------------------------------------------------------------------------
-- Triggers: forward-only kind / account_kind; parent must be super_org;
-- access_mode / account_kind ↔ org shape
-- ---------------------------------------------------------------------------
create or replace function public.organizations_parent_must_be_super_org()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if not exists (
      select 1 from public.organizations p
      where p.id = new.parent_id and p.kind = 'super_org'
    ) then
      raise exception 'organizations.parent_id must reference a super_org'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger organizations_parent_super_org_trg
  before insert or update of parent_id on public.organizations
  for each row execute function public.organizations_parent_must_be_super_org();

create or replace function public.organizations_kind_forward_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.kind is distinct from new.kind then
    -- allowed: org → super_org only
    if not (old.kind = 'org' and new.kind = 'super_org') then
      raise exception 'organizations.kind may only move org → super_org'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger organizations_kind_forward_trg
  before update of kind on public.organizations
  for each row execute function public.organizations_kind_forward_only();

create or replace function public.billing_accounts_kind_forward_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.account_kind is distinct from new.account_kind then
    if not (
      (old.account_kind = 'individual' and new.account_kind in ('org', 'super_org'))
      or (old.account_kind = 'org' and new.account_kind = 'super_org')
    ) then
      raise exception 'billing_accounts.account_kind may only move forward'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger billing_accounts_kind_forward_trg
  before update of account_kind on public.billing_accounts
  for each row execute function public.billing_accounts_kind_forward_only();

create or replace function public.billing_accounts_shape_matches_owner()
returns trigger
language plpgsql
as $$
declare
  org_kind text;
  org_parent uuid;
begin
  if new.owner_user_id is not null then
    if new.account_kind <> 'individual' or new.access_mode <> 'subscription' then
      raise exception 'individual wallet must be account_kind=individual access_mode=subscription'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select o.kind, o.parent_id into org_kind, org_parent
  from public.organizations o where o.id = new.owner_org_id;

  if org_kind is null then
    raise exception 'billing_accounts.owner_org_id must exist'
      using errcode = '23514';
  end if;

  if new.account_kind <> org_kind then
    raise exception 'billing_accounts.account_kind must match organizations.kind'
      using errcode = '23514';
  end if;

  if org_parent is not null then
    -- child org
    if new.access_mode <> 'prepaid' then
      raise exception 'child-org wallet must be access_mode=prepaid'
        using errcode = '23514';
    end if;
  else
    if new.access_mode <> 'subscription' then
      raise exception 'org/super_org wallet without parent must be access_mode=subscription'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger billing_accounts_shape_trg
  before insert or update on public.billing_accounts
  for each row execute function public.billing_accounts_shape_matches_owner();

create or replace function public.users_upgraded_org_id_forward_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if old.upgraded_org_id is not null
       and new.upgraded_org_id is distinct from old.upgraded_org_id then
      raise exception 'users.upgraded_org_id cannot be cleared or retargeted'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger users_upgraded_org_forward_trg
  before update of upgraded_org_id on public.users
  for each row execute function public.users_upgraded_org_id_forward_only();

-- ---------------------------------------------------------------------------
-- Ledger: transfer / debt types + tenant columns
-- ---------------------------------------------------------------------------
alter table public.credit_transactions
  drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions
  add constraint credit_transactions_type_check
    check (type in (
      'grant', 'debit', 'refund', 'expire',
      'debt_recovery', 'transfer_out', 'transfer_in'
    ));

alter table public.credit_transactions
  add column if not exists org_id uuid references public.organizations (id);

alter table public.credit_transactions
  add column if not exists super_org_id uuid references public.organizations (id);

alter table public.credit_transactions
  add column if not exists counterparty_billing_account_id uuid
    references public.billing_accounts (id);

create index if not exists credit_transactions_org_created_idx
  on public.credit_transactions (org_id, created_at);

create index if not exists credit_transactions_super_org_created_idx
  on public.credit_transactions (super_org_id, created_at);

-- Child-org 1.5% credit-limit window (§5.2)
create index if not exists credit_transactions_child_limit_idx
  on public.credit_transactions (billing_account_id, created_at)
  where type in ('transfer_in', 'debt_recovery');

-- ---------------------------------------------------------------------------
-- gateway_jobs tenant columns
-- ---------------------------------------------------------------------------
alter table public.gateway_jobs
  add column if not exists org_id uuid references public.organizations (id);

alter table public.gateway_jobs
  add column if not exists super_org_id uuid references public.organizations (id);

-- ---------------------------------------------------------------------------
-- contact_submissions: super-org applications
-- ---------------------------------------------------------------------------
alter table public.contact_submissions
  add column if not exists user_id text references public.users (id);

alter table public.contact_submissions
  add column if not exists subject_org_id uuid references public.organizations (id);

alter table public.contact_submissions
  add column if not exists approved_at timestamptz;

alter table public.contact_submissions
  add column if not exists approved_by text references public.users (id);

-- ---------------------------------------------------------------------------
-- usage_daily (analytics view for dashboards next)
-- ---------------------------------------------------------------------------
create or replace view public.usage_daily as
select
  date_trunc('day', created_at) as day,
  billing_account_id,
  super_org_id,
  org_id,
  user_id,
  end_customer_ref,
  provider,
  model,
  count(*) filter (where type = 'debit') as requests,
  sum(case type when 'debit' then amount when 'refund' then -amount else 0 end) as credits,
  sum(cost_usd) as cost_usd
from public.credit_transactions
where type in ('debit', 'refund')
group by 1, 2, 3, 4, 5, 6, 7, 8;

-- ---------------------------------------------------------------------------
-- Join-code redeem rate limit (same shape as upload_rate_limits)
-- ---------------------------------------------------------------------------
create table public.join_rate_limits (
  user_id text primary key references public.users (id),
  window_start_ms bigint not null,
  count integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Lock-down new tables (same pattern as PR 1)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in (
        'organizations', 'memberships', 'invitations', 'join_codes',
        'join_rate_limits'
      )
  loop
    execute format('alter table public.%I enable row level security', r.name);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
