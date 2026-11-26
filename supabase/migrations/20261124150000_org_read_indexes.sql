-- Keyset reads for the org Jobs and Activity pages.
-- gateway_jobs already has billing_account indexes; these follow org_id.

create index if not exists gateway_jobs_org_created_idx
  on public.gateway_jobs (org_id, created_at desc, id desc);

create index if not exists gateway_jobs_org_user_created_idx
  on public.gateway_jobs (org_id, user_id, created_at desc, id desc);

create index if not exists audit_log_org_created_id_idx
  on public.audit_log (org_id, created_at desc, id desc);
