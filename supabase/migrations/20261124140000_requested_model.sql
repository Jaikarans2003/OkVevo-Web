-- What the user picked, stored once at reserve. Nullable, no backfill.
-- The existing model column stays the routed/billed id.

alter table public.credit_transactions add column if not exists requested_model text;
alter table public.gateway_jobs add column if not exists requested_model text;

create index if not exists credit_transactions_account_reqmodel_created_idx
  on public.credit_transactions (billing_account_id, requested_model, created_at);

create index if not exists gateway_jobs_account_created_idx
  on public.gateway_jobs (billing_account_id, created_at desc, id desc);

create index if not exists gateway_jobs_account_user_created_idx
  on public.gateway_jobs (billing_account_id, user_id, created_at desc, id desc);
