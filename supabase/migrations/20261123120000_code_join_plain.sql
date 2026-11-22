-- Code join: drop invite/dept surface; plaintext join_codes; owner|member only;
-- advisor fixes (search_path + unindexed FKs). Forward-only. PR2 never on prod.

-- ---------------------------------------------------------------------------
-- A. Drop unused invite / department schema
-- ---------------------------------------------------------------------------
alter table public.memberships drop column if exists department_id;
alter table public.contact_submissions drop column if exists extra_owners;

drop table if exists public.org_invitations cascade;
drop table if exists public.invitations cascade;
drop table if exists public.departments cascade;

-- ---------------------------------------------------------------------------
-- B. Roles: admin → member; CHECK owner|member only
-- ---------------------------------------------------------------------------
update public.memberships set role = 'member' where role = 'admin';

alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check check (role in ('owner', 'member'));

-- ---------------------------------------------------------------------------
-- C. join_codes → plaintext code only
-- ---------------------------------------------------------------------------
-- Revoke every hash-era active code before remint.
update public.join_codes
set revoked_at = coalesce(revoked_at, now())
where revoked_at is null;

alter table public.join_codes add column if not exists code text;

-- Relax hash-era NOT NULL so remint rows can omit code_hash.
alter table public.join_codes alter column code_hash drop not null;
alter table public.join_codes alter column role drop not null;

-- Remint one active prefixed code per org (16 bytes ≈ 128 bits → base64url).
insert into public.join_codes (org_id, code, created_by, created_at)
select
  o.id,
  (case when o.kind = 'super_org' then 'okv_sorg_' else 'okv_org_' end)
    || rtrim(
      translate(encode(gen_random_bytes(16), 'base64'), '+/', '-_'),
      '='
    ),
  o.created_by,
  now()
from public.organizations o;

-- Staging may still have hash-era rows with code NULL after remint — drop them
-- before NOT NULL (empty CI DB never hit this).
delete from public.join_codes where code is null;

alter table public.join_codes alter column code set not null;

alter table public.join_codes drop constraint if exists join_codes_code_hash_key;
drop index if exists public.join_codes_code_hash_key;
alter table public.join_codes drop column if exists code_hash;
alter table public.join_codes drop column if exists role;
alter table public.join_codes drop column if exists expires_at;
alter table public.join_codes drop column if exists max_uses;
alter table public.join_codes drop column if exists uses;

create unique index if not exists join_codes_code_uidx on public.join_codes (code);

drop index if exists public.join_codes_one_active_per_org_idx;
create unique index join_codes_one_active_per_org_idx
  on public.join_codes (org_id)
  where revoked_at is null;

-- Fail-closed: RLS already on from pr2; reaffirm revoke.
alter table public.join_codes enable row level security;
revoke all on table public.join_codes from anon, authenticated;
grant all on table public.join_codes to service_role;

-- ---------------------------------------------------------------------------
-- D. Advisor: function search_path (security WARN)
-- ---------------------------------------------------------------------------
alter function public.organizations_parent_must_be_super_org() set search_path = public;
alter function public.organizations_kind_forward_only() set search_path = public;
alter function public.billing_accounts_kind_forward_only() set search_path = public;
alter function public.billing_accounts_shape_matches_owner() set search_path = public;
alter function public.users_upgraded_org_id_forward_only() set search_path = public;
alter function public.reject_personal_wallet_when_upgraded() set search_path = public;

-- ---------------------------------------------------------------------------
-- E. Advisor: unindexed FKs (performance)
-- ---------------------------------------------------------------------------
create index if not exists contact_submissions_user_id_idx
  on public.contact_submissions (user_id);
create index if not exists contact_submissions_subject_org_id_idx
  on public.contact_submissions (subject_org_id);
create index if not exists contact_submissions_approved_by_idx
  on public.contact_submissions (approved_by);

create index if not exists credit_transactions_counterparty_billing_account_id_idx
  on public.credit_transactions (counterparty_billing_account_id);

create index if not exists fal_media_index_uid_idx
  on public.fal_media_index (uid);

create index if not exists gateway_jobs_org_id_idx
  on public.gateway_jobs (org_id);
create index if not exists gateway_jobs_super_org_id_idx
  on public.gateway_jobs (super_org_id);

create index if not exists join_codes_created_by_idx
  on public.join_codes (created_by);

create index if not exists organizations_created_by_idx
  on public.organizations (created_by);

create index if not exists audit_log_actor_user_id_idx
  on public.audit_log (actor_user_id);
