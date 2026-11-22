# Supabase Advisors — after code join (local + staging expectation)

Captured 2026-11-23 after migration `20261123120000_code_join_plain.sql` on **local** Supabase (`supabase db reset` then `supabase db lint --local`).

## Local `supabase db lint --local`

**Result:** `No schema errors found.`

Assumes migrations through `20261123120000_code_join_plain.sql` are applied (plaintext `join_codes`, invite/department tables dropped, `search_path` set on listed functions, FK indexes from section E).

## Compare to `docs/ops/advisor-before-code-join.md`

| Area | Before (staging snapshot) | After (local, post-migration) |
|------|---------------------------|-------------------------------|
| **Security WARN** `function_search_path_mutable` (6 functions) | Present | **Fixed** — migration D sets `search_path = public` on all six |
| **Performance INFO** `unindexed_foreign_keys` | 14 rows (incl. dropped `invitations`, `org_invitations`, `memberships.department_id`) | **Fixed locally** for retained tables — migration E adds indexes; FKs on dropped invite/dept tables **gone** with those tables |
| **INFO** `rls_enabled_no_policy` | 25 tables (incl. `invitations`, `org_invitations`, `departments`) | Local catalog no longer lists dropped invite tables; join_codes + core tables unchanged fail-closed pattern |
| **INFO** `unused_index` | Includes `org_invitations_*` | Local: invite-related unused indexes removed with tables |

## Remote okvevo-staging (`wnbaxrmnnnfmrquwgsac`)

MCP `get_advisors` on staging **until this PR deploys / migration runs there** will still reflect the **pre-migration** snapshot:

- Security WARNs on the six `search_path` functions
- Performance INFO unindexed FKs referencing **`invitations`**, **`org_invitations`**, **`memberships.department_id`**
- `rls_enabled_no_policy` still naming invite tables

That is **expected** — staging advisors update after `20261123120000` is applied on okvevo-staging, not from local lint alone.

## Verify locally

```bash
cd OkVevo-Web
npx supabase db reset   # if needed
npx supabase db lint --local
```

Expected: `No schema errors found.`