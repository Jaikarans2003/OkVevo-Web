-- Code-join pgTAP: plaintext join_codes, dropped invite/dept tables, role check.
begin;
select plan(8);

insert into public.users (id) values ('_pgtap_cj_owner');

insert into public.organizations (id, public_id, kind, name, created_by)
values (
  '30000000-0000-4000-8000-000000000001',
  'org_pgtap_cj0000000001',
  'org',
  'CJ Org',
  '_pgtap_cj_owner'
);

select ok(
  (select to_regclass('public.invitations') is null),
  'invitations table dropped'
);

select ok(
  (select to_regclass('public.org_invitations') is null),
  'org_invitations table dropped'
);

select ok(
  (select to_regclass('public.departments') is null),
  'departments table dropped'
);

select ok(
  (select count(*) = 0
     from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'department_id'),
  'memberships.department_id dropped'
);

select ok(
  (select count(*) = 0
     from information_schema.columns
    where table_schema = 'public'
      and table_name = 'join_codes'
      and column_name = 'code_hash'),
  'join_codes.code_hash dropped'
);

insert into public.join_codes (org_id, code, created_by)
values (
  '30000000-0000-4000-8000-000000000001',
  'okv_org_first_active_code_xxxxx',
  '_pgtap_cj_owner'
);

select throws_ok(
  $$insert into public.join_codes (org_id, code, created_by)
    values (
      '30000000-0000-4000-8000-000000000001',
      'okv_org_second_active_code_xxxx',
      '_pgtap_cj_owner'
    )$$,
  '23505',
  null,
  'only one non-revoked join code per org'
);

select throws_ok(
  $$insert into public.memberships (org_id, user_id, role, status)
    values (
      '30000000-0000-4000-8000-000000000001',
      '_pgtap_cj_owner',
      'admin',
      'active'
    )$$,
  '23514',
  null,
  'memberships.role rejects admin'
);

insert into public.memberships (org_id, user_id, role, status)
values (
  '30000000-0000-4000-8000-000000000001',
  '_pgtap_cj_owner',
  'owner',
  'active'
);

select ok(
  (select role = 'owner' from public.memberships
    where org_id = '30000000-0000-4000-8000-000000000001'
      and user_id = '_pgtap_cj_owner'),
  'memberships accepts owner'
);

select finish();
rollback;
