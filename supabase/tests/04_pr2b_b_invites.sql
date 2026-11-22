-- PR 2b-b pgTAP: new tables RLS + partial unique indexes + anon grants.
begin;
select plan(7);

insert into public.users (id) values ('_pgtap_inv_owner');

insert into public.organizations (id, public_id, kind, name, created_by)
values (
  '30000000-0000-4000-8000-000000000001',
  'org_pgtap_inv000000001',
  'org',
  'Inv Org',
  '_pgtap_inv_owner'
);

insert into public.organizations (id, public_id, kind, name, created_by)
values (
  '30000000-0000-4000-8000-000000000002',
  'sorg_pgtap_inv00000001',
  'super_org',
  'Inv Super',
  '_pgtap_inv_owner'
);

select is(
  (select relrowsecurity from pg_class where relname = 'departments'),
  true,
  'departments has RLS enabled'
);

select is(
  (select relrowsecurity from pg_class where relname = 'org_invitations'),
  true,
  'org_invitations has RLS enabled'
);

select ok(
  (select count(*) = 0
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'departments'
      and grantee = 'anon'),
  'anon has no grants on departments'
);

select ok(
  (select count(*) = 0
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'org_invitations'
      and grantee = 'anon'),
  'anon has no grants on org_invitations'
);

insert into public.join_codes (org_id, code_hash, role, created_by)
values (
  '30000000-0000-4000-8000-000000000001',
  'hash_active_one',
  'member',
  '_pgtap_inv_owner'
);

select throws_ok(
  $$insert into public.join_codes (org_id, code_hash, role, created_by)
    values (
      '30000000-0000-4000-8000-000000000001',
      'hash_active_two',
      'member',
      '_pgtap_inv_owner'
    )$$,
  '23505',
  null,
  'only one non-revoked join code per org'
);

update public.join_codes set revoked_at = now()
where org_id = '30000000-0000-4000-8000-000000000001' and revoked_at is null;

insert into public.org_invitations (super_org_id, org_id, invited_by, status)
values (
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  '_pgtap_inv_owner',
  'pending'
);

select throws_ok(
  $$insert into public.org_invitations (super_org_id, org_id, invited_by, status)
    values (
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000001',
      '_pgtap_inv_owner',
      'pending'
    )$$,
  '23505',
  null,
  'only one pending org_invitation per org'
);

insert into public.departments (org_id, name)
values ('30000000-0000-4000-8000-000000000001', 'Engineering');

select throws_ok(
  $$insert into public.departments (org_id, name)
    values ('30000000-0000-4000-8000-000000000001', 'Engineering')$$,
  '23505',
  null,
  'departments unique per org name'
);

select finish();
rollback;