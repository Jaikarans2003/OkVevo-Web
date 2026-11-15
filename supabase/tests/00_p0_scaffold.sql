-- Kept so CI always has at least one pgTAP file before lock-down grows.
begin;
select plan(1);
select pass('p0 supabase scaffold');
select * from finish();
rollback;
