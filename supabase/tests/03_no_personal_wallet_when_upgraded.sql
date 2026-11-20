-- Trigger: no personal billing_accounts row when users.upgraded_org_id is set.
begin;
select plan(2);

insert into public.users (id) values ('_pgtap_upgraded_owner');
insert into public.organizations (id, public_id, kind, name, created_by)
values (
  '10000000-0000-4000-8000-0000000000a1',
  'org_pgtap_upgraded00000a1',
  'org',
  'Upgraded Org',
  '_pgtap_upgraded_owner'
);
update public.users
set upgraded_org_id = '10000000-0000-4000-8000-0000000000a1'
where id = '_pgtap_upgraded_owner';

select throws_ok(
  $$insert into public.billing_accounts (owner_user_id)
    values ('_pgtap_upgraded_owner')$$,
  'P0001',
  'personal_wallet_forbidden_when_upgraded',
  'personal billing_accounts insert rejected when upgraded_org_id is set'
);

insert into public.users (id) values ('_pgtap_individual_ok');

select lives_ok(
  $$insert into public.billing_accounts (owner_user_id)
    values ('_pgtap_individual_ok')$$,
  'individual without upgraded_org_id may insert a personal wallet'
);

select * from finish();
rollback;
