-- PR 2 pgTAP: org hierarchy + forward-only kinds + prepaid negative top_up.
begin;
select plan(12);

-- Parent of a child org must be a super_org
insert into public.users (id) values ('_pgtap_org_owner');
insert into public.organizations (id, public_id, kind, name, created_by)
values (
  '10000000-0000-4000-8000-000000000001',
  'org_pgtap_plain00000001',
  'org',
  'Plain Org',
  '_pgtap_org_owner'
);

select throws_ok(
  $$insert into public.organizations (public_id, kind, parent_id, name, created_by)
    values ('org_pgtap_badchild000001', 'org',
            '10000000-0000-4000-8000-000000000001',
            'Bad Child', '_pgtap_org_owner')$$,
  '23514',
  null,
  'child org parent must be a super_org'
);

insert into public.organizations (id, public_id, kind, name, created_by)
values (
  '10000000-0000-4000-8000-000000000002',
  'sorg_pgtap_super00000001',
  'super_org',
  'Super',
  '_pgtap_org_owner'
);

insert into public.organizations (id, public_id, kind, parent_id, name, created_by)
values (
  '10000000-0000-4000-8000-000000000003',
  'org_pgtap_child000000001',
  'org',
  '10000000-0000-4000-8000-000000000002',
  'Child',
  '_pgtap_org_owner'
);

-- Forward-only: cannot move super_org → org
select throws_ok(
  $$update public.organizations
      set kind = 'org'
    where id = '10000000-0000-4000-8000-000000000002'$$,
  '23514',
  null,
  'organizations.kind cannot move super_org → org'
);

-- Forward-only: org → super_org is allowed
select lives_ok(
  $$update public.organizations
      set kind = 'super_org', parent_id = null
    where id = '10000000-0000-4000-8000-000000000001'$$,
  'organizations.kind may move org → super_org'
);

-- Child prepaid wallet may go negative; subscription may not
insert into public.billing_accounts (
  id, owner_org_id, account_kind, access_mode, top_up_balance, top_up_reference
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  'org',
  'prepaid',
  0,
  0
);

select lives_ok(
  $$update public.billing_accounts
      set top_up_balance = -100
    where id = '20000000-0000-4000-8000-000000000001'$$,
  'prepaid child wallet may go negative on top_up_balance'
);

insert into public.users (id) values ('_pgtap_indiv2');
insert into public.billing_accounts (id, owner_user_id, account_kind, access_mode)
values (
  '20000000-0000-4000-8000-000000000002',
  '_pgtap_indiv2',
  'individual',
  'subscription'
);

select throws_ok(
  $$update public.billing_accounts
      set top_up_balance = -1
    where id = '20000000-0000-4000-8000-000000000002'$$,
  '23514',
  null,
  'subscription wallet still rejects negative top_up_balance'
);

-- account_kind must match organizations.kind
select throws_ok(
  $$insert into public.billing_accounts (
      id, owner_org_id, account_kind, access_mode
    ) values (
      '20000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000002',
      'org',
      'subscription'
    )$$,
  '23514',
  null,
  'billing_accounts.account_kind must match organizations.kind'
);

-- Super-org subscription wallet OK
select lives_ok(
  $$insert into public.billing_accounts (
      id, owner_org_id, account_kind, access_mode
    ) values (
      '20000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000002',
      'super_org',
      'subscription'
    )$$,
  'super_org wallet with matching kind + subscription access_mode'
);

-- Forward-only account_kind on billing_accounts
select throws_ok(
  $$update public.billing_accounts
      set account_kind = 'individual', owner_org_id = null, owner_user_id = '_pgtap_indiv2'
    where id = '20000000-0000-4000-8000-000000000004'$$,
  '23514',
  null,
  'billing_accounts.account_kind cannot move backwards'
);

-- upgraded_org_id cannot be cleared
update public.users
set upgraded_org_id = '10000000-0000-4000-8000-000000000002'
where id = '_pgtap_org_owner';

select throws_ok(
  $$update public.users set upgraded_org_id = null where id = '_pgtap_org_owner'$$,
  '23514',
  null,
  'users.upgraded_org_id cannot be cleared'
);

-- New ledger types accepted
select lives_ok(
  $$insert into public.credit_transactions (
      id, billing_account_id, type, bucket, amount
    ) values (
      'xfer_pgtap:out',
      '20000000-0000-4000-8000-000000000004',
      'transfer_out',
      'top_up',
      10
    )$$,
  'credit_transactions accepts transfer_out'
);

select lives_ok(
  $$insert into public.credit_transactions (
      id, billing_account_id, type, bucket, amount
    ) values (
      'xfer_pgtap:debt',
      '20000000-0000-4000-8000-000000000001',
      'debt_recovery',
      'top_up',
      5
    )$$,
  'credit_transactions accepts debt_recovery'
);

-- RLS still on for new tables
select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in ('organizations', 'memberships', 'invitations', 'join_codes')
  ),
  'RLS enabled on PR 2 org tables'
);

select * from finish();
rollback;
