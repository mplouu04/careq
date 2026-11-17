# CareQ requirements (phone-only)

**Status:** Source of truth for the phone-only multi-tenant product direction.  
**Scope:** Business rules only. Implementation details live in `docs/flow.md` and `docs/gap-analysis.md`.  
**Do not** treat kiosk or printed tickets as product requirements.

---

## Product principle

Patients and guardians book, join the queue, check in, track position, and receive call alerts **entirely from a phone**. Staff dashboards and TV boards remain for clinic operations. Front desk may create a ticket when a patient has no phone.

---

## Actors

| Actor | Description |
|-------|-------------|
| **Patient** | Person receiving care; may hold their own phone session. |
| **Guardian** | Adult who can manage one or more **dependents** (e.g. children) under their account/session. |
| **Staff** | Roles: `admin`, `doctor`, `nurse`, `receptionist` (existing enum). |
| **System** | Cron / hold expiry / auto no-show / notification fan-out. |

---

## Join paths

1. **Booked appointment** — Choose service and slot on the CareQ booking flow; receive confirmation (email today; SMS when enabled) with a reference code. Ticket starts as `booked` until same-day remote join or on-site check-in.
2. **Remote same-day join** — From phone, before arriving, join the live clinic queue for today. Ticket enters `remote_waiting` with a configurable **hold time**. Live position may be shown; patient is not considered on-site until QR check-in.
3. **Walk-in via clinic QR** — Scan the clinic entrance/front-desk QR on phone → register or verify → ticket created as `waiting` (on-site) or guided through identity first.

Legacy “I’m here” check-in without QR may remain as staff fallback; product default is **phone + clinic QR**.

---

## On-site check-in (clinic QR)

- Scanning the **clinic QR** (or equivalent authenticated on-site check-in) moves a ticket from **`remote_waiting` → `waiting`**.
- Booked patients who arrive check in the same way (reference/QR + verify as required).
- Identity verification uses **minimal details** and **privacy-safe errors** (never reveal whether another patient exists beyond a generic failure). Current phone last-7 + DOB is **not** the long-term auth model; see OTP in gap analysis.

---

## Remote hold expiry

- Tickets in `remote_waiting` **expire** if not checked in within a **per-clinic configurable hold time**.
- On expiry: transition to a terminal/cancel-style outcome (e.g. `cancelled` with reason `hold_expired`) and free queue capacity; notify patient when possible.
- Hold duration is stored in clinic settings (not hard-coded).

---

## Priority and ordering

When choosing who is next for nurse pull / doctor call (among eligible lounge states):

1. **Booked patient inside their slot window** — highest priority among ready candidates.
2. **Others by check-in time** (FIFO on `waiting` / post-triage ready pools as applicable).
3. **Optional priority tiers** (`low` / `normal` / `high` / `emergency` or clinic-defined) may reorder within or above FIFO per clinic policy.

Desk override (call from waiting without triage) remains allowed for staff when nurse is unavailable, but should respect priority when auto-selecting “Call next.”

---

## Call flow

| Action | Rule |
|--------|------|
| **Call** | Staff assigns doctor + room; ticket → `called`; TV “Now Calling”; push (+ SMS fallback). |
| **Recall** | Re-call same or updated room/doctor; max **N** recalls per ticket (clinic setting). |
| **No-show** | After grace or staff action → `no_show`. |
| **Skipped** | Staff skip → `skipped`; may be **re-queued** back into an eligible waiting state. |
| **Present / in service** | Staff mark patient present → `in_service` (maps from today’s `in_progress`). |
| **Done** | Staff complete → `done`. |

---

## Appointment vs ticket states (canonical)

**`booked` is an appointment / check-in status**, not a live queue ticket. Tickets exist only from **`remote_waiting` onward** (see [`docs/flow.md`](flow.md)).

### Appointment / checkin

| Status | Meaning |
|--------|---------|
| `booked` (or equivalent pending) | Appointment reserved; no queue ticket yet. |

### Live queue tickets

| State | Meaning |
|-------|---------|
| `remote_waiting` | Joined queue from phone; not yet on-site (hold timer active). |
| `waiting` | On-site / checked in; in lounge line. |
| `called` | Called to a station/room (triage or service, per routing). |
| `in_triage` | With nurse for vitals / history. |
| `waiting_for_service` | Triage complete; waiting for doctor/lab/service Call. |
| `in_service` | With clinician / in procedure. |
| `done` | Visit completed. |
| `no_show` | Missed call / marked no-show. |
| `skipped` | Returned from service path; can re-queue. |
| `cancelled` | Cancelled by patient, staff, or system (e.g. hold expired). |

Mapping from current enum values is documented in `docs/gap-analysis.md` (data migration plan).

---

## Notifications

| Event | Channel |
|-------|---------|
| **Approaching** | When position ≤ **per-clinic threshold** (default **3**). Web Push first; SMS fallback if configured and push unavailable/undelivered. |
| **Called** | Web Push first; SMS fallback. |
| Booking / reminders / follow-up | Email (existing Resend path) and/or SMS when enabled. |

Push is **opt-in**. Never require push to complete check-in.

---

## TV board privacy

- Display **ticket / queue number** and **counter / room** (and status such as Now Calling) only.
- **Never** show patient or guardian names on public boards.

---

## Front-desk phoneless ticket

- Receptionist/admin may **create a ticket** for a patient **without a phone**.
- Ticket participates in the same state machine; notifications that require a device are skipped or delayed until a phone is linked.
- Prefer linking a guardian phone when available.

---

## Multi-tenant (normative for target architecture)

- Every core row is scoped by **`clinic_id`**.
- Queue state changes go through **Postgres functions** that enforce `clinic_id` and **caller role** inside the function (service role bypasses RLS — do not rely on RLS alone for queue writes).

---

## Explicit non-goals (this requirements set)

- Physical kiosk hardware product.
- Printed paper tickets as a required path.
- Auto specialty / symptom → doctor AI routing.
- Hospital HMO LOA / Maxicare Gateway (unless later scoped).
