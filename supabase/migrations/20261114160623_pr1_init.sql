-- PR 1 schema: individual wallets + ported ops tables only.
-- No organizations / memberships / transfers / usage_daily (those are PR 2).

create extension if not exists pgcrypto;

-- people
create table public.users (
  id text primary key,
  email text,
  display_name text,
  phone_number text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- wallets (individual only in PR 1)
create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null unique references public.users (id),
  account_kind text not null default 'individual'
    check (account_kind = 'individual'),
  access_mode text not null default 'subscription'
    check (access_mode = 'subscription'),
  plan text,
  plan_name text,
  plan_status text,
  billing_cycle text,
  currency text,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  payment_method text,
  credits_included integer not null default 0,
  allocation_balance integer not null default 0,
  top_up_balance integer not null default 0,
  allocation_granted_total integer not null default 0,
  top_up_purchased_total integer not null default 0,
  next_allocation_date timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  has_scheduled_changes boolean not null default false,
  scheduled_plan_type text,
  scheduled_plan_id text,
  scheduled_change_at timestamptz,
  concurrency_override integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allocation_balance >= 0),
  check (top_up_balance >= 0)
);

create index billing_accounts_plan_status_next_alloc_idx
  on public.billing_accounts (plan_status, next_allocation_date);

-- append-only ledger
create table public.credit_transactions (
  id text primary key,
  billing_account_id uuid not null references public.billing_accounts (id),
  user_id text references public.users (id),
  end_customer_ref text,
  type text not null check (type in ('grant', 'debit', 'refund', 'expire')),
  bucket text check (bucket in ('allocation', 'top_up')),
  amount integer not null check (amount >= 0),
  absorbed integer not null default 0 check (absorbed >= 0),
  expires_at timestamptz,
  mode text,
  reason text,
  request_id text,
  provider text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric,
  price_usd numeric,
  created_at timestamptz not null default now()
);

create index credit_transactions_account_created_idx
  on public.credit_transactions (billing_account_id, created_at desc);
create index credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at);

-- holds (was gatewayJobs)
create table public.gateway_jobs (
  id text primary key,
  billing_account_id uuid not null references public.billing_accounts (id),
  user_id text not null references public.users (id),
  end_customer_ref text,
  provider text,
  status text,
  estimated_credits integer,
  held_allocation integer,
  held_top_up integer,
  settled_credits integer,
  actual_credits integer,
  captured boolean not null default false,
  alias_of text,
  hold_expires_at timestamptz,
  endpoint text,
  unit text,
  unit_price numeric,
  submit_args jsonb,
  fal_status_url text,
  fal_response_url text,
  fal_cancel_url text,
  hold_id text,
  payload jsonb,
  character text,
  project text,
  consent_at text,
  sample_sha256 text,
  media jsonb,
  price_snapshot jsonb,
  fal_body jsonb,
  reserved_fal_usd numeric,
  spend_day text,
  release_reason text,
  -- Fal queue/dispatch fields (ported with debit.ts / captureCredits.ts in PR 1 slice).
  cancel_requested boolean not null default false,
  queue_position integer,
  fal_request_id text,
  run_id text,
  client_message text,
  client_code text,
  vendor_status integer,
  submit_attempts integer not null default 0,
  first_reject_at_ms bigint,
  next_attempt_at_ms bigint,
  captured_at timestamptz,
  captured_fal_usd numeric,
  request_id text,
  -- Fal dispatch/settle timestamps (ported with dispatch.ts / handleQueue.ts).
  dispatched_at timestamptz,
  settled_at timestamptz,
  settled_fal_usd numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gateway_jobs_user_status_idx on public.gateway_jobs (user_id, status);
create index gateway_jobs_account_status_idx on public.gateway_jobs (billing_account_id, status);
create index gateway_jobs_status_expires_idx on public.gateway_jobs (status, hold_expires_at);
create index gateway_jobs_provider_status_captured_idx
  on public.gateway_jobs (provider, status, captured);

-- Razorpay webhook dedupe (new)
create table public.razorpay_webhook_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);

-- Razorpay subscription mirror (was razorpaySubscriptions + nested users/{uid}/subscriptions)
create table public.razorpay_subscriptions (
  id text primary key,
  billing_account_id uuid references public.billing_accounts (id),
  status text,
  plan_type text,
  charge_count integer not null default 0,
  last_payment_id text,
  last_payment_amount integer,
  last_payment_at timestamptz,
  notes jsonb,
  cancel_at_cycle_end boolean,
  -- Coupon/affiliate fields seeded on the subscription record itself (webhook write-only today).
  coupon_code text,
  coupon_type text,
  affiliate_id text,
  discount_amount text,
  coupon_applied boolean,
  -- Lifecycle timestamps (ported 1:1 with the webhook's per-event writes).
  activated_at timestamptz,
  halted_at timestamptz,
  cancelled_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  grace_period_ends_at timestamptz,
  last_payment_failure jsonb,
  invoice_paid_at timestamptz,
  -- Legacy subscription-doc display credits (Pro-Team / old UI). Two-bucket grants go via grantCredits.
  credits integer,
  initial_credits integer,
  credits_used integer,
  payment_method text,
  payment_method_updated_at timestamptz,
  -- UPI upgrade-flow replacement bookkeeping.
  being_replaced_by text,
  will_cancel_at timestamptz,
  replacing_subscription_id text,
  will_activate_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index razorpay_subscriptions_billing_account_id_idx
  on public.razorpay_subscriptions (billing_account_id);

-- Fal run idempotency (was gatewayIdempotency)
create table public.fal_run_idempotency (
  id text primary key,
  user_id text not null references public.users (id),
  run_id text not null,
  body_hash text,
  phase text,
  submit_started boolean not null default false,
  hold_id text,
  fal_request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fal_run_idempotency_user_id_idx on public.fal_run_idempotency (user_id);

-- Per-user Fal concurrency queue (was falQueue)
create table public.fal_queues (
  user_id text primary key references public.users (id),
  running jsonb not null default '[]'::jsonb,
  queued jsonb not null default '[]'::jsonb,
  queued_count integer not null default 0,
  needs_submit boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Daily Fal spend rollup (was spendDaily)
create table public.spend_daily (
  day date primary key,
  fal_usd_held numeric not null default 0,
  fal_usd numeric not null default 0,
  credits_charged integer not null default 0,
  jobs integer not null default 0,
  over_reserve_events integer not null default 0
);

-- Ops alerts (was opsAlerts)
create table public.ops_alerts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Daily admin rollup (was adminRollups; written by cron/fal-drift)
create table public.admin_rollups (
  day date primary key,
  data jsonb not null default '{}'::jsonb,
  written_at timestamptz not null default now()
);

-- Desktop sign-in codes (was desktopAuthCodes)
create table public.desktop_auth_codes (
  code text primary key,
  user_id text not null references public.users (id),
  state text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index desktop_auth_codes_user_id_idx on public.desktop_auth_codes (user_id);

-- Drama measured uploads (was dramaUploads)
create table public.drama_uploads (
  id text primary key,
  user_id text not null references public.users (id),
  path text not null,
  kind text,
  mime text,
  duration_seconds double precision,
  width integer,
  height integer,
  bytes bigint,
  sha256 text,
  generation text,
  created_at timestamptz not null default now()
);

create index drama_uploads_user_id_idx on public.drama_uploads (user_id);

-- Upload rate limits (was dramaUploadRates)
create table public.upload_rate_limits (
  user_id text primary key references public.users (id),
  window_start_ms bigint not null,
  count integer not null default 0
);

-- Prior Fal output media index (was falMediaIndex)
create table public.fal_media_index (
  id text primary key,
  url text not null,
  kind text not null check (kind in ('video', 'audio', 'image')),
  seconds double precision,
  width integer,
  height integer,
  -- Settle-time provenance (ported with mediaResolve.ts).
  endpoint text,
  uid text references public.users (id),
  request_id text,
  created_at timestamptz not null default now()
);

-- Cloned voice ownership (was clonedVoices)
create table public.cloned_voices (
  id text primary key,
  user_id text not null references public.users (id),
  custom_voice_id text not null,
  character text,
  project text,
  cloned_at text,
  used_in_tts_at text,
  consent_at text,
  sample_sha256 text,
  status text not null default 'active' check (status in ('active', 'deleted')),
  deleted_at text,
  created_at timestamptz not null default now()
);

create index cloned_voices_user_id_idx on public.cloned_voices (user_id);

-- Contact form (plain categories only in PR 1)
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  email text not null,
  message text not null,
  whatsapp text,
  created_at timestamptz not null default now()
);

-- Lock-down: RLS on, no anon/authenticated grants, future defaults locked, no GraphQL
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
      and c.relname not like 'pg_%'
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

drop extension if exists pg_graphql;
