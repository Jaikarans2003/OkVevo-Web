-- Reject a personal billing_accounts insert when the user already upgraded.
-- FOR SHARE matches the lock Postgres takes for a foreign-key check so an
-- in-flight upgrade/approval commits before this trigger reads upgraded_org_id.

create or replace function public.reject_personal_wallet_when_upgraded()
returns trigger
language plpgsql
as $$
declare
  upgraded uuid;
begin
  if new.owner_user_id is null then
    return new;
  end if;

  select u.upgraded_org_id
    into upgraded
  from public.users u
  where u.id = new.owner_user_id
  for share;

  if upgraded is not null then
    raise exception 'personal_wallet_forbidden_when_upgraded'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists billing_accounts_no_personal_when_upgraded on public.billing_accounts;

create trigger billing_accounts_no_personal_when_upgraded
  before insert on public.billing_accounts
  for each row
  execute function public.reject_personal_wallet_when_upgraded();
