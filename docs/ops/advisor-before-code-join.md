# Supabase Advisors — before (okvevo-staging / wnbaxrmnnnfmrquwgsac)

Captured 2026-11-23 via MCP `get_advisors` before `feat/code-join-one-dashboard` migration.

## Security

### WARN — function_search_path_mutable (6)
- `public.organizations_parent_must_be_super_org`
- `public.organizations_kind_forward_only`
- `public.billing_accounts_kind_forward_only`
- `public.billing_accounts_shape_matches_owner`
- `public.users_upgraded_org_id_forward_only`
- `public.reject_personal_wallet_when_upgraded`

Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

### INFO — rls_enabled_no_policy (25)
Intentional fail-closed pattern (RLS on, no policies, revoke anon/authenticated; app uses service/DATABASE_URL).
Tables include: admin_rollups, audit_log, billing_accounts, cloned_voices, contact_submissions, credit_transactions, departments, desktop_auth_codes, drama_uploads, fal_media_index, fal_queues, fal_run_idempotency, gateway_jobs, invitations, join_codes, join_rate_limits, memberships, ops_alerts, org_invitations, organizations, razorpay_subscriptions, razorpay_webhook_events, spend_daily, upload_rate_limits, users.

## Performance

### INFO — unindexed_foreign_keys (14)
- contact_submissions: approved_by, subject_org_id, user_id
- credit_transactions: counterparty_billing_account_id
- fal_media_index: uid
- gateway_jobs: org_id, super_org_id
- invitations: accepted_by, department_id, invited_by (dropped with table)
- join_codes: created_by
- memberships: department_id (dropped with column)
- org_invitations: invited_by (dropped with table)
- organizations: created_by

Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

### INFO — unused_index (9)
join_codes_org_id_idx, desktop_auth_codes_user_id_idx, gateway_jobs_provider_status_captured_idx, fal_run_idempotency_user_id_idx, org_invitations_*, drama_uploads_user_id_idx, cloned_voices_user_id_idx, audit_log_org_created_idx
