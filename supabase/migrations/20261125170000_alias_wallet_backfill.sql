-- Fal request-id alias rows used to stamp the personal wallet via getBillingByUserId.
-- Copy the parent hold's wallet/org onto every alias. Safe to re-run.
update gateway_jobs as alias
set
  billing_account_id = parent.billing_account_id,
  org_id = parent.org_id,
  super_org_id = parent.super_org_id
from gateway_jobs as parent
where alias.alias_of is not null
  and alias.alias_of = parent.id
  and (
    alias.billing_account_id is distinct from parent.billing_account_id
    or alias.org_id is distinct from parent.org_id
    or alias.super_org_id is distinct from parent.super_org_id
  );
