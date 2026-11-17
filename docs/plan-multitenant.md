# Plan: multi-tenant foundation (step 2)

**Status:** Amended — Stage A migration **files** may be written; **do not apply** until you approve running them. No app code in this pass.  
**Sources:** [`gap-analysis.md`](gap-analysis.md), [`requirements.md`](requirements.md), [`.cursor/rules/careq.mdc`](../.cursor/rules/careq.mdc).

---

## Goals

1. `clinics` + `clinic_id` on core tenant data; `staff_clinics` membership.
2. Backfill into one default clinic; temporary `clinic_id` DEFAULT; later drop DEFAULT (Stage C).
3. RLS: staff via membership; **no anon SELECT** on tenant tables (public via Route Handlers only).
4. Tenant resolution: `/c/[slug]/...`; flat URLs redirect to `/c/<slug>/...`.
5. Public realtime: **invalidation-only** broadcast; clients refetch clinic-scoped APIs.
6. `checkin_to_queue` clinic-scoped (Stage B); DB trigger broadcasts via `realtime.send`.

---

## Default clinic slug

- Replace with your real slug before apply: documented as **`<MY REAL SLUG>`**.
- **Format:** lowercase `a-z`, digits `0-9`, hyphens `-`; length **2–48**; must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- **Reserved (reject):** `www`, `api`, `admin`, `login`, `dashboard`, `queue`, `status`, `c`, `static`, `assets`, `health`, `cron`, `supabase`, `null`, `undefined`.
- Slugs appear in **QR codes**. Changes need **`clinic_slug_redirects`** (`old_slug` → `clinic_id`).
- Migration seed uses a replace-me value; see `031` header comment.

---

## Stages (verify on branch between stages)

| Stage | Migrations | Gate |
|-------|------------|------|
| **A** | `031`–`034` + `034c` (+ `034b` after rpc-callers) | Rehearse + verify script on Supabase branch / data copy. App may still omit `clinic_id` (DEFAULT covers). See [`rehearsal-runbook.md`](./rehearsal-runbook.md). |
| **B** | `035`–`037` | **Before `036`:** ship app that (1) uses **broadcast invalidation** subscribers, (2) clinic-scoped service-role queries for TV/status. Then apply `035`–`037` (RPC + revoke anon SELECT + views). Verify TV + status still update after revoke. |
| **C** | `038` | App always writes `clinic_id` explicitly → drop temporary DEFAULTs. |

---

## Realtime

### Decision: invalidation-only broadcast on `clinic:{id}:queue`

**Payload (only):** `{ "clinic_id": "<uuid>", "changed": true }`  
**No** queue numbers, rooms, statuses, or PII in the broadcast.

**Why:** Public broadcast channels can be **spoofed**. Clients must not trust broadcast content for display. On receipt, **TV board** and **patient status** (and similar) **refetch** from clinic-scoped **service-role Route Handlers**. Spoofed events at worst cause an extra refetch; they cannot inject fake tickets.

**Emission:** **Database trigger on `queue`** calling **`realtime.send`** (topic e.g. `clinic:{clinic_id}:queue`, event `invalidate`). Covers **all** write paths: RPCs, cron auto no-show, staff updates — do **not** rely on app code to emit.

**Staff dashboard:** keep **`postgres_changes` on `queue`** under membership RLS (full row for ops).

### Consumer plan (app — later)

| Surface | Behavior |
|---------|----------|
| TV board | Subscribe to invalidation broadcast → refetch `/api/queue/public` (service-role, clinic-scoped) |
| Patient status | Same → refetch `/api/queue?ref=` (clinic + ref); rate-limited |
| Spoof test | Inject fake broadcast → UI data unchanged except refetch from API |

---

## New tables

### `clinics` / `staff_clinics` / `clinic_slug_redirects`

As before. Seed default clinic; backfill all staff into `staff_clinics` with current `staff.role`.

**Interim:** prefer `staff_clinics.role`; may fall back to `staff.role` until per-clinic roles are editable.  
**Then remove `staff.role` fallback.**

---

## Tables receiving `clinic_id`

Same list as prior plan (`patients`, `checkins`, `queue`, `rooms`, `display_settings`, `appointment_types`, `doctor_schedules`, `doctor_blocks`, `patient_sessions`, `push_subscriptions`, `email_*`, `clinic_settings`, `daily_counters`, `reminder_failures`, `audit_log` nullable). Optional `rate_limits.clinic_id`.

**Uniques:** per-clinic for queue numbers, counters, phones, references, push endpoints.

**Temporary DEFAULT** after backfill (034); **drop in 038** (Stage C).

---

## RLS (Stage B target)

Helpers **`staff_in_clinic`**, **`staff_clinic_role`**:  
`SECURITY DEFINER`, **`STABLE`**, **fixed `search_path`** (e.g. `pg_catalog, public`) — avoids RLS recursion on `staff_clinics`.

| Table | anon | staff |
|-------|------|--------|
| `clinics` | **none** — resolve slug via Route Handler | SELECT if member |
| `queue` | **none** | ALL if member |
| `rooms`, `display_settings`, `appointment_types`, `doctor_schedules`, `doctor_blocks` | **none** — public via clinic-scoped Route Handlers only | ALL if member |
| `patients`, `checkins`, … | **none** | per membership |
| sessions / push / counters | none | none (service + clinic filter) |

---

## `checkin_to_queue` (Stage B — `035`)

```text
checkin_to_queue(p_checkin_id, p_prefix, p_clinic_id)
```

- Validate checkin belongs to `p_clinic_id`; clinic-scoped `daily_counters`; insert `queue.clinic_id`.
- **Same migration: `DROP FUNCTION` old 2-arg signature** to avoid overloads.
- Broadcast comes from **queue trigger**, not from the RPC body alone.

---

## Views (Stage B — `037`)

Recreate `doctors_public` (and similar) with **`security_invoker = true`** and **clinic scoping**.

---

## Public status lookup

- Confirm appointment/queue **reference numbers are long/random** (not guessable sequential public IDs alone for APT lookup — keep current opaque refs; queue numbers stay short for TV but status URLs should use clinic slug + ref and **rate-limit** via **`rate_limits`**).
- Enumerate/guessing protected by rate limits on public status/check-in lookup APIs.

---

## Tenant resolution

| Today | Target |
|-------|--------|
| Flat `/checkin`, `/status/...` | `/c/<MY REAL SLUG>/...` |
| Old flat URLs | **Temporary redirect** to `/c/<MY REAL SLUG>/...` (**not** 410) |

---

## Migration file order

### Stage A (files written this pass — do not apply yet)

| File | Purpose |
|------|---------|
| [`031_clinics_and_membership.sql`](../supabase/migrations/031_clinics_and_membership.sql) | clinics, staff_clinics, slug redirects, seed, staff backfill |
| [`032_clinic_id_columns_nullable.sql`](../supabase/migrations/032_clinic_id_columns_nullable.sql) | nullable `clinic_id` |
| [`033_clinic_id_backfill.sql`](../supabase/migrations/033_clinic_id_backfill.sql) | temporary `clinic_id` DEFAULTs + backfill (no `rate_limits` backfill) |
| [`034_clinic_id_default_not_null_fks.sql`](../supabase/migrations/034_clinic_id_default_not_null_fks.sql) | assert DEFAULTs; NOT NULL; FKs RESTRICT **NOT VALID**; clinic-scoped uniques/indexes; `next_counter` rewrite + service_role GRANT |
| [`034c_validate_clinic_fks.sql`](../supabase/migrations/034c_validate_clinic_fks.sql) | `VALIDATE CONSTRAINT` on all `*_clinic_id_fkey` |
| [`034b_revoke_client_rpc.sql`](../supabase/migrations/034b_revoke_client_rpc.sql) | Revoke anon/authenticated/PUBLIC EXECUTE on `next_counter` / `checkin_to_queue` (after [`rpc-callers.md`](./rpc-callers.md); apply after first old-app smoke) |
| [`verify_stage_a_multitenant.sql`](../supabase/migrations/verify_stage_a_multitenant.sql) | verification queries (manual) |
| Rollbacks | `supabase/rollback/031_rollback.sql` … `034b_rollback.sql` — scratch only, **before a second clinic** |

### Stage B (not written yet)

| File | Purpose |
|------|---------|
| `035_checkin_to_queue_clinic.sql` | New 3-arg RPC; **DROP** old 2-arg |
| `036_rls_clinic_policies.sql` | DEFINER helpers; revoke anon SELECTs; staff policies |
| `037_doctors_public_security_invoker.sql` | Views + queue invalidation trigger (`realtime.send`) |

**Deploy before 036:** broadcast invalidation subscribers + clinic-scoped public APIs.

### Stage C (not written yet)

| File | Purpose |
|------|---------|
| `038_clinic_id_drop_defaults.sql` | Drop temporary `clinic_id` DEFAULTs; drop legacy global uniques/PKs; elevate clinic-scoped constraints |

---

## Test checklist

### Ops

- [ ] Backup; rehearse migrations **and rollbacks** on Supabase branch / data copy
- [ ] **Stage gates:** verify after A, after B, after C

### Data / concurrency

- [ ] Default clinic + slug; all rows backfilled
- [ ] Concurrent ticket issuance across **two clinics**
- [ ] No cross-clinic push/patient leak

### AuthZ / realtime

- [ ] Staff A cannot access B
- [ ] Anon cannot SELECT `queue` (after 036)
- [ ] Anon cannot SELECT rooms / display_settings / appointment_types / doctor_* / clinics (after 036)
- [ ] Spoofed broadcast **does not** change displayed data (only triggers refetch; API is source of truth)
- [ ] Cron auto no-show updates board (trigger → invalidate → refetch)
- [ ] TV board + status page **keep updating after anon SELECT revoke**

### Transition

- [ ] Old app version still works against migrated DB during DEFAULT window (Stage A–C)
- [ ] Flat URL → `/c/<slug>/...` redirect
- [ ] Status lookup rate-limited; refs not trivially enumerable

---

## Missing / Later

| Item | Notes |
|------|--------|
| Platform admin / clinic creation | Create clinics, first admin, slug redirects UI |
| Phone OTP + SMS | Gap step 3 |
| Per-clinic role editor | Then remove `staff.role` fallback |
| Remote join / QR | After OTP |
| Ticket state rename | After foundation |

---

## Stop

Stage A **files** are in repo for review. **Do not run** against any database until you approve apply. Stage B/C and app code wait for separate approval.
