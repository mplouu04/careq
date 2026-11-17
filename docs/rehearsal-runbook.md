# Stage A scratch-database rehearsal runbook

**Do not run against production.** Use a Supabase branch or restored copy only.  
Companion: [`conflict-targets.md`](./conflict-targets.md), [`rpc-callers.md`](./rpc-callers.md),  
`supabase/migrations/verify_stage_a_multitenant.sql`, `scripts/verify-counter-concurrency.mjs`,  
`supabase/rollback/*_rollback.sql`.

Default clinic: `a0000000-0000-4000-8000-000000000001` · slug `careq`

Mark each box **PASS** or **FAIL** (and stop on FAIL unless the step says otherwise).

---

## 0. Backup

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL | Create or confirm a disposable branch / dump restore. Record project ref / dump timestamp. Confirm URLs do **not** point at production. |

---

## 1. BEFORE counts

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL | On an **idle** branch (no concurrent writes), uncomment and run the **BEFORE** block in `verify_stage_a_multitenant.sql` (creates `public._verify_rowcounts_before`). Re-comment that block afterward. |

---

## 2. Apply Stage A DDL: `031` → `034c`

Apply in order on the scratch DB (psql / SQL editor). Each file must COMMIT cleanly.

| | Migration |
|---|-----------|
| [ ] PASS / [ ] FAIL | `031_clinics_and_membership.sql` (`SET LOCAL lock_timeout = '5s'`) |
| [ ] PASS / [ ] FAIL | `032_clinic_id_columns_nullable.sql` (`SET LOCAL lock_timeout = '5s'`) |
| [ ] PASS / [ ] FAIL | `033_clinic_id_backfill.sql` |
| [ ] PASS / [ ] FAIL | `034_clinic_id_default_not_null_fks.sql` (FKs **NOT VALID**; no VALIDATE here) |
| [ ] PASS / [ ] FAIL | `034c_validate_clinic_fks.sql` (all `VALIDATE CONSTRAINT …_clinic_id_fkey`) |

**Do not apply `034b` yet** — old-app client EXECUTE still present for the first old-app smoke.

---

## 3. Verify script — structural checks

Run the **AFTER — structural FAIL checks** section of `verify_stage_a_multitenant.sql`  
(checks **1–10**, including informational trigger list **10d**).  
Convention: **0 FAIL rows** = healthy.

| | Check |
|---|--------|
| [ ] PASS / [ ] FAIL | 1 Default clinic present |
| [ ] PASS / [ ] FAIL | 2 No NULL `clinic_id` on NOT NULL targets |
| [ ] PASS / [ ] FAIL | 3 `audit_log` / `rate_limits` nullable `clinic_id` |
| [ ] PASS / [ ] FAIL | 4 Staff membership |
| [ ] PASS / [ ] FAIL | 5 Temporary DEFAULTs |
| [ ] PASS / [ ] FAIL | 6 `daily_counters` clinic-scoped unique |
| [ ] PASS / [ ] FAIL | 7 Unique indexes (legacy + clinic-scoped names/cols) |
| [ ] PASS / [ ] FAIL | 8 FKs exist, **validated**, `ON DELETE RESTRICT` (needs **034c**) |
| [ ] PASS / [ ] FAIL | 9 Cross-table `clinic_id` consistency |
| [ ] PASS / [ ] FAIL | 10 Slug helper + default slug (+ review **10d** triggers before DDL tests) |

---

## 4. Verify script — transactional tests (each separately)

Run **each** block as its **own** `BEGIN`…`ROLLBACK` execution.  
On error: `ROLLBACK;` manually before the next test.  
Expect `RAISE NOTICE 'PASS: …'` (or equivalent) per test.

| | Test |
|---|------|
| [ ] PASS / [ ] FAIL | 11 `next_counter` smoke (default clinic) |
| [ ] PASS / [ ] FAIL | 12 Two-clinic counter independence (drops legacy PK **inside txn only**) |
| [ ] PASS / [ ] FAIL | 13 Two-clinic `queue_number` uniqueness |
| [ ] PASS / [ ] FAIL | 14 Legacy `checkin_to_queue(integer, text)` |
| [ ] PASS / [ ] FAIL | 15 Redirect `old_slug` conflict with live slug |
| [ ] PASS / [ ] FAIL | 16 `clinics.updated_at` trigger |
| [ ] PASS / [ ] FAIL | 17 Legacy conflict targets + DEFAULT `clinic_id` on insert-without-column |

**Skip 18–19 until after `034b`.**

---

## 5. Old-app flow (pre-`034b`)

With the **current** app (no Stage A app changes), against the scratch DB:

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL | Staff login works |
| [ ] PASS / [ ] FAIL | Patient check-in / booking path that issues a queue number via `next_counter` / `checkin_to_queue` succeeds |
| [ ] PASS / [ ] FAIL | TV / status surfaces still load (anon SELECT still present until Stage B) |

---

## 6. Apply `034b` (revoke client RPC)

Confirm [`rpc-callers.md`](./rpc-callers.md): only service-role callers for `next_counter` / `checkin_to_queue`.

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL | Apply `034b_revoke_client_rpc.sql` |
| [ ] PASS / [ ] FAIL | Verify test **18** (service_role can execute + insert paths) |
| [ ] PASS / [ ] FAIL | Verify test **19** (anon gets `42501` on both RPCs) |

---

## 7. Old-app flow again (post-`034b`)

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL | Same staff + check-in / ticket path still works via **service-role** Route Handlers |
| [ ] PASS / [ ] FAIL | Direct client/browser call to `next_counter` / `checkin_to_queue` is denied (optional spot-check) |

---

## 8. Concurrency script

```bash
ALLOW_BRANCH_ONLY=1 PRODUCTION_PROJECT_REF=<prod-ref> \
  VERIFY_SUPABASE_URL=<branch-url> VERIFY_SUPABASE_SERVICE_ROLE_KEY=<branch-srk> \
  node scripts/verify-counter-concurrency.mjs
```

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL / [ ] N/A | Script prints `PASS: no duplicate counter values per clinic…` |

**Stage A note:** legacy `daily_counters_pkey (counter_date, counter_key)` still exists, so true cross-clinic independence often **FAIL**s here until Stage C (or a deliberate scratch drop of that PK). Treat a unique/PK cross-clinic collision as **expected on Stage A**; record **N/A** and rely on verify test **12** for the temporary-drop proof. Re-run for a hard **PASS** after Stage C on a fresh branch.

---

## 9. Row-count drift + cleanup

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL | Run the final row-count comparison DO block in the verify script. Core tables must not drift; scratch `_verify_rowcounts_before` drops on success. |

---

## 10. Rollback rehearsal (scratch only)

**WARNING:** rollbacks are valid **only before a second clinic exists** (single default-clinic era). Prefer a **fresh restore** after this section — do not leave a half-rolled DB as your “good” Stage A artifact.

Order (reverse of apply; skip files never applied):

| | Step |
|---|------|
| [ ] PASS / [ ] FAIL | `supabase/rollback/034b_rollback.sql` (if 034b applied) |
| [ ] PASS / [ ] FAIL | `supabase/rollback/034_rollback.sql` (drops indexes/FKs/NOT NULL/DEFAULTs; restores 2-arg `next_counter` + grants). **034c** has no separate rollback — VALIDATE is undone by dropping FKs here. |
| [ ] PASS / [ ] FAIL | `supabase/rollback/033_rollback.sql` |
| [ ] PASS / [ ] FAIL | `supabase/rollback/032_rollback.sql` |
| [ ] PASS / [ ] FAIL | `supabase/rollback/031_rollback.sql` |
| [ ] PASS / [ ] FAIL | Spot-check: `clinics` / `staff_clinics` gone; `clinic_id` columns gone; `next_counter(date, text)` callable as before Stage A |

Optional: restore from backup again and re-apply `031`→`034c` (+`034b`) once to confirm the forward path still works after a rollback dry-run on a sibling copy.

---

## Pass criteria (whole rehearsal)

- All structural checks **0 FAIL rows** after `034c`
- Tests **11–17** PASS; **18–19** PASS after `034b`
- Old-app ticket path works **before and after** `034b`
- Concurrency: **PASS** or documented Stage A **N/A** with test **12** PASS
- Rollback scripts run cleanly on a single-clinic scratch DB
