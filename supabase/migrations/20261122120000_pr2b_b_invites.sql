-- PR 2b-b: departments, org invitations, join code uniqueness, contact columns.
-- Forward-only. RLS on, no policies, revoke anon/authenticated (same as pr2_orgs).

-- --- departments ---
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists departments_org_id_idx on public.departments (org_id);

alter table public.departments enable row level security;
revoke all on table public.departments from anon, authenticated;
grant all on table public.departments to service_role;

-- --- memberships.department_id ---
alter table public.memberships
  add column if not exists department_id uuid references public.departments (id) on delete set null;

-- --- invitations.department_id ---
alter table public.invitations
  add column if not exists department_id uuid references public.departments (id) on delete set null;

-- --- join_codes: one active code per org ---
drop index if exists public.join_codes_one_active_per_org_idx;
create unique index join_codes_one_active_per_org_idx
  on public.join_codes (org_id)
  where revoked_at is null;

-- --- org_invitations (super-org invites existing org) ---
create table if not exists public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  super_org_id uuid not null references public.organizations (id),
  org_id uuid not null references public.organizations (id),
  invited_by text not null references public.users (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index org_invitations_super_org_id_idx on public.org_invitations (super_org_id);
create index org_invitations_org_id_idx on public.org_invitations (org_id);

create unique index org_invitations_one_pending_per_org_idx
  on public.org_invitations (org_id)
  where status = 'pending';

alter table public.org_invitations enable row level security;
revoke all on table public.org_invitations from anon, authenticated;
grant all on table public.org_invitations to service_role;

-- --- contact_submissions: super-org application extras ---
alter table public.contact_submissions
  add column if not exists requested_name text,
  add column if not exists extra_owners jsonb;