# Supabase `.rpc()` callers (`app` / `lib` / `components`)

Generated from `grep -rn "rpc(" app lib components`. No matches under `components/`.

| File | RPC | Client | Safe if `next_counter` / `checkin_to_queue` revoked from anon/authenticated? |
|------|-----|--------|-------------------------------------------------------------------------------|
| `lib/counters.ts` | `next_counter` | **service role** (`createAdminClient`) | **Yes** — only caller of `next_counter` |
| `lib/counters.ts` | `checkin_to_queue` | **service role** (`createAdminClient`) | **Yes** — only caller of `checkin_to_queue` |
| `lib/rate-limit.ts` | `increment_rate_limit` | **service role** | N/A (other RPC) |
| `lib/rate-limit.ts` | `record_verification_failure` | **service role** | N/A |
| `lib/services/appointment.service.ts` | `book_appointment_slot` | **service role** | N/A (uses `nextAppointmentReference` → `next_counter` via counters helper, still service role) |
| `lib/services/retention.service.ts` | `purge_old_logs` | **service role** | N/A |
| `lib/services/retention.service.ts` | `purge_expired_email_verify` | **service role** | N/A |
| `lib/services/queue-metrics.ts` | `get_avg_service_minutes` | **service role** (or injected admin client from queue route) | N/A |
| `lib/services/queue-metrics.ts` | `get_queue_served_by_day` | **service role** | N/A |
| `app/api/queue/route.ts` | `get_queue_waiting_position` | **service role** (`createAdminClient`) | N/A |
| `app/api/admin/doctors/route.ts` | `upsert_doctor_schedules` | **service role** (`createAdminClient`) | N/A |

## Verdict for `034b_revoke_client_rpc.sql`

**Safe to apply** after Stage A `034`: every `next_counter` and `checkin_to_queue` call uses the **service-role** admin client. No browser/anon/session client invokes them.

Apply order: `034` → confirm this doc → `034b` → run verify (incl. role tests 18–19).
