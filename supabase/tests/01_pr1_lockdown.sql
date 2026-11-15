-- PR 1 pgTAP: RLS lockdown + money guards (constraints + PK uniqueness).
begin;
select plan(9);

-- Every public base table has RLS enabled
select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  ),
  'RLS enabled on every public table'
);

-- anon has no table privileges in public
select is(
  (
    select count(*)::int
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
  ),
  0,
  'anon has no privileges on public tables'
);

-- authenticated has no table privileges in public
select is(
  (
    select count(*)::int
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
  ),
  0,
  'authenticated has no privileges on public tables'
);

-- pg_graphql must be absent
select ok(
  not exists (select 1 from pg_extension where extname = 'pg_graphql'),
  'pg_graphql extension is absent'
);

-- A table created after the migration is still unreadable by anon (default privileges)
create table public._pgtap_lock_probe (id int primary key);
select is(
  has_table_privilege('anon', 'public._pgtap_lock_probe', 'select'),
  false,
  'anon cannot select a table created after migration defaults'
);
drop table public._pgtap_lock_probe;

-- Money guards (behavioral)
insert into public.users (id) values ('_pgtap_money');
insert into public.billing_accounts (id, owner_user_id)
values ('00000000-0000-4000-8000-000000000001', '_pgtap_money');

select throws_ok(
  $$update public.billing_accounts
      set allocation_balance = -1
    where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'billing_accounts rejects negative allocation_balance'
);

select throws_ok(
  $$update public.billing_accounts
      set top_up_balance = -1
    where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'billing_accounts rejects negative top_up_balance'
);

select throws_ok(
  $$insert into public.credit_transactions
      (id, billing_account_id, type, amount)
    values
      ('_pgtap_txn', '00000000-0000-4000-8000-000000000001', 'grant', -1)$$,
  '23514',
  null,
  'credit_transactions rejects amount < 0'
);

insert into public.credit_transactions (id, billing_account_id, type, amount)
values ('_pgtap_txn', '00000000-0000-4000-8000-000000000001', 'grant', 1);

select throws_ok(
  $$insert into public.credit_transactions
      (id, billing_account_id, type, amount)
    values
      ('_pgtap_txn', '00000000-0000-4000-8000-000000000001', 'grant', 1)$$,
  '23505',
  null,
  'duplicate credit_transactions id fails'
);

select * from finish();
rollback;
