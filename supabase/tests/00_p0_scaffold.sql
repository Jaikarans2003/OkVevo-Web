-- P0 scaffold smoke. Real pgTAP lock-down lands with the schema/tests phases.
BEGIN;
SELECT plan(1);
SELECT pass('p0 supabase scaffold');
SELECT * FROM finish();
ROLLBACK;
