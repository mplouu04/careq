# CareQ Capstone Demo Script

Apply migration `040_capstone_extensions.sql` on your **local or scratch** Supabase project before demoing capstone features (do not apply multi-tenant `031+` for this capstone track).

**UI:** CareQ blue/white tokens (`#2563EB` / `#F8F9FB` / `#E2E5EA`), Inter, phone-first hub with Maxicare-inspired journey (phone replaces kiosk).

**Deploy:** After verifying locally, push to the existing Vercel project (`careq-ten`) when ready — confirm env vars still match.

## Test accounts (placeholders)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@clinic.test` | *(set in Supabase)* |
| Doctor | `doctor@clinic.test` | *(set in Supabase)* |
| Receptionist | `reception@clinic.test` | *(set in Supabase)* |
| Patient phone | `09171234567` | DOB `1990-01-15` |

Replace with your seeded staff rows and a test patient from registration.

## Phone-first patient journey

1. Open `/` — Patient Hub shows clinic announcement strip when active.
2. **Book** — `/patient-search?intent=book` → verify or register → pick doctor (specialization in catalog) → book slot.
3. **My visits** — `/my-appointments` → phone + DOB → see `Awaiting approval` badge → try **Reschedule**.
4. **Profile** — `/patient-profile` → lookup → update email/address.
5. **Notifications** — `/notifications` → same lookup → confirmation + approval messages after admin acts.
6. **Check-in** — `/checkin` when arriving (unchanged core flow).

## Staff / admin journey

1. **Admin** — `/admin` → **Appointments** tab → **Approve** or **Reject** pending bookings.
2. **Announcements** — publish a hub strip message.
3. **Reports** — daily/monthly counts.
4. **Staff** — set doctor **Specialization**; **Appointment types** → optional **Fee**.
5. **Dashboard** — receptionist/nurse: **Today's queue history** toggle.
6. **Doctor login** — `/dashboard` shows **DoctorDashboard** (today's appointments + assigned queue).

## API highlights

- `POST /api/appointments` — `action: reschedule`, `staff_update` with `approve`/`reject`
- `POST /api/patients/profile` — lookup / patch
- `POST /api/notifications` — list / mark_read
- `GET /api/announcements` — public active list
- `GET /api/queue/history` — staff today terminal queue rows

## Future enhancements

- SMS/email delivery for notifications (in-app only today)
- Patient push for approval events (reuse Web Push stack)
- Multi-clinic `clinic_id` on announcements/notifications (post–Stage A)
- Reschedule UI with live slot picker (availability API)
- Payment capture linked to `appointment_types.fee`
- Doctor dashboard: in-place call/done actions without full queue board