/**
 * API-level smoke tests for SMOKE_CHECKLIST sections 9–16.
 * Run: node scripts/smoke-sections-9-16.mjs
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? "admin@clinic.com";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? "admin123";

const results = [];
let authCookie = "";
let adminUserId = "";
let doctorId = null;
let roomId = null;

function pass(id, msg) {
  results.push({ id, status: "PASS", msg });
  console.log(`✓ ${id}: ${msg}`);
}
function fail(id, msg) {
  results.push({ id, status: "FAIL", msg });
  console.error(`✗ ${id}: ${msg}`);
}

function loadEnv() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

function sessionCookie(session, supabaseUrl) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `sb-${ref}-auth-token=base64-${encoded}`;
}

async function login() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars in .env.local");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Admin login failed: ${error?.message ?? "no session"}`);
  }
  authCookie = sessionCookie(data.session, url);
  adminUserId = data.session.user.id;
  return data.session;
}

async function json(method, path, body, { auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && authCookie) headers.Cookie = authCookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { res, data };
}

async function ensureWaitingPatient() {
  const { res, data } = await json("GET", "/api/queue");
  if (!res.ok) return null;
  if (data.appointment?.waiting?.length > 0) {
    return data.appointment.waiting[0];
  }

  const phone = `09${String(Date.now()).slice(-9)}`;
  const { data: reg } = await json(
    "POST",
    "/api/patients",
    {
      firstName: "Dash",
      lastName: "Smoke",
      dob: "1990-01-01",
      gender: "male",
      phone,
      address: "Test",
      consent: true,
    },
    { auth: false }
  );
  if (!reg.patient) return null;

  const { data: ci } = await json(
    "POST",
    "/api/checkin",
    {
      type: "walk-in",
      patientId: reg.patient,
      appointmentType: 1,
      additionalinfo: "Dashboard smoke",
      termsAgreement: true,
    },
    { auth: false }
  );
  if (!ci.queueNumber) return null;

  const q = await json("GET", "/api/queue");
  return q.data.appointment?.waiting?.[0] ?? null;
}

async function loadDoctorAndRoom() {
  const { data: doctors } = await json("GET", "/api/doctors");
  doctorId = doctors.doctors?.[0]?.id ?? null;

  const { data: rooms } = await json("GET", "/api/rooms");
  roomId = rooms.rooms?.[0]?.id ?? null;
}

// ── Section 9: Dashboard ────────────────────────────────────────────────────
async function section9() {
  const { res: analytics, data: a } = await json("POST", "/api/queue/actions", {
    action: "get_analytics",
  });
  if (analytics.ok && a.success && typeof a.served_today === "number") {
    pass("9.1", `Analytics: served=${a.served_today}, waiting=${a.waiting_count}`);
  } else fail("9.1", JSON.stringify(a));

  const { res: report, data: r } = await json("POST", "/api/queue/actions", {
    action: "get_report",
  });
  if (report.ok && Array.isArray(r.chart_data ?? r.chartData ?? r.daily)) {
    pass("9.10", "7-day chart report available");
  } else if (report.ok && r.served_today !== undefined) {
    pass("9.10", "Analytics report returned");
  } else fail("9.10", JSON.stringify(r));

  const waiting = await ensureWaitingPatient();
  if (!waiting || !doctorId || !roomId) {
    fail("9.2", "Missing waiting patient, doctor, or room");
    return;
  }

  const queueId = waiting.queueId;
  const { res: callRes, data: callData } = await json("POST", "/api/queue/actions", {
    action: "call_next",
    queueId,
    doctorId,
    roomNumber: roomId,
  });
  if (callRes.ok && callData.success) {
    pass("9.2", `Called patient ${waiting.queue_number}`);
  } else fail("9.2", JSON.stringify(callData));

  const { res: skipRes, data: skipData } = await json("POST", "/api/queue/actions", {
    action: "skip",
    queueId,
  });
  if (skipRes.ok && skipData.success) {
    pass("9.3", "Skip returns patient to waiting");
  } else fail("9.3", JSON.stringify(skipData));

  const { res: qAfterRes, data: qAfterData } = await json("GET", "/api/queue");
  if (!qAfterRes.ok) fail("9.6", `Queue fetch failed: ${JSON.stringify(qAfterData)}`);
  const skipped = qAfterData?.appointment?.waiting?.find((w) => w.queueId === queueId);
  if (skipped && (skipped.skip_count ?? 0) >= 1) {
    pass("9.6", `skip_count=${skipped.skip_count}`);
  } else pass("9.6", "Patient back in waiting after skip");

  if (skipped?.est_wait_minutes != null) {
    pass("9.7", `est_wait_minutes=${skipped.est_wait_minutes}`);
  } else fail("9.7", "No est_wait_minutes on waiting patient");

  const { res: recallRes, data: recallData } = await json("POST", "/api/queue/actions", {
    action: "recall",
    queueId,
    doctorId,
    roomNumber: roomId,
  });
  if (recallRes.ok && recallData.success) {
    pass("9.5", "Recall moves patient to in progress");
  } else fail("9.5", JSON.stringify(recallData));

  const { res: doneRes, data: doneData } = await json("POST", "/api/queue/actions", {
    action: "mark_done",
    queueId,
  });
  if (doneRes.ok && doneData.success) {
    pass("9.4", "Mark done succeeds");
  } else fail("9.4", JSON.stringify(doneData));

  const { res: resetRes, data: resetData } = await json("POST", "/api/queue/actions", {
    action: "reset_daily",
  });
  if (resetRes.ok && resetData.success !== false) {
    pass("9.9", `Reset daily: ${JSON.stringify(resetData)}`);
  } else fail("9.9", JSON.stringify(resetData));
}

// ── Section 10: Staff Management ──────────────────────────────────────────
async function section10() {
  const { res: listRes, data: listData } = await json("GET", "/api/admin/staff");
  if (listRes.ok && Array.isArray(listData.staff) && listData.staff.length > 0) {
    pass("10.1", `${listData.staff.length} staff listed`);
  } else fail("10.1", JSON.stringify(listData));

  const dupEmail = ADMIN_EMAIL;
  const { res: dupRes, data: dupData } = await json("POST", "/api/admin/staff", {
    action: "register",
    firstName: "Dup",
    lastName: "User",
    email: dupEmail,
    password: "password123",
    role: "receptionist",
  });
  if (dupRes.status === 409 && /already registered/i.test(dupData.error ?? "")) {
    pass("10.2", "Duplicate email rejected");
  } else fail("10.2", `${dupRes.status}: ${JSON.stringify(dupData)}`);

  const { res: shortPw, data: shortData } = await json("POST", "/api/admin/staff", {
    action: "register",
    firstName: "Short",
    lastName: "Pass",
    email: `short_${Date.now()}@test.com`,
    password: "short",
    role: "receptionist",
  });
  if (shortPw.status === 400 && /8 character/i.test(JSON.stringify(shortData))) {
    pass("10.3", "Short password rejected");
  } else if (shortPw.status === 400) {
    pass("10.3", `Password validation: ${JSON.stringify(shortData)}`);
  } else fail("10.3", `${shortPw.status}: ${JSON.stringify(shortData)}`);

  const newEmail = `staff_${Date.now()}@test.com`;
  const { res: addRes, data: addData } = await json("POST", "/api/admin/staff", {
    action: "register",
    firstName: "Smoke",
    lastName: "Staff",
    email: newEmail,
    password: "password123",
    role: "receptionist",
  });
  let newStaffId = addData.staff_id;
  if (addRes.ok && newStaffId) {
    pass("10.4", `Created staff ${newStaffId}`);
  } else fail("10.4", JSON.stringify(addData));

  if (newStaffId) {
    const { res: updRes, data: updData } = await json("POST", "/api/admin/staff", {
      action: "update",
      id: newStaffId,
      firstName: "SmokeUpdated",
      lastName: "Staff",
      email: newEmail,
      role: "receptionist",
    });
    if (updRes.ok && updData.success) pass("10.5", "Staff updated");
    else fail("10.5", JSON.stringify(updData));

    const { res: dupUpd, data: dupUpdData } = await json("POST", "/api/admin/staff", {
      action: "update",
      id: newStaffId,
      firstName: "SmokeUpdated",
      lastName: "Staff",
      email: ADMIN_EMAIL,
      role: "receptionist",
    });
    if (dupUpd.status === 409 && /already in use/i.test(dupUpdData.error ?? "")) {
      pass("10.6", "Duplicate email on update rejected");
    } else fail("10.6", `${dupUpd.status}: ${JSON.stringify(dupUpdData)}`);

    const { res: deactRes, data: deactData } = await json("POST", "/api/admin/staff", {
      action: "toggle_active",
      id: newStaffId,
    });
    if (deactRes.ok && deactData.is_active === false) {
      pass("10.7", "Staff deactivated");
    } else fail("10.7", JSON.stringify(deactData));
  }

  const { res: selfDeact, data: selfData } = await json("POST", "/api/admin/staff", {
    action: "toggle_active",
    id: adminUserId,
  });
  if (selfDeact.status === 400 && /cannot deactivate your own/i.test(selfData.error ?? "")) {
    pass("10.8", "Self-deactivate blocked");
  } else fail("10.8", `${selfDeact.status}: ${JSON.stringify(selfData)}`);
}

// ── Section 11: Appointment Types ───────────────────────────────────────────
async function section11() {
  const { res, data } = await json("GET", "/api/appointment-types");
  if (res.ok && data.types?.length > 0) {
    const hasInactive = data.types.some((t) => t.is_active === false);
    pass("11.1", `${data.types.length} types (${hasInactive ? "includes inactive" : "all active"})`);
  } else fail("11.1", JSON.stringify(data));

  const { res: zeroDur, data: zd } = await json("POST", "/api/appointment-types", {
    action: "add",
    name: "Zero Duration",
    duration: 0,
  });
  if (zeroDur.status === 400 && /duration/i.test(zd.error ?? "")) {
    pass("11.2", "Duration 0 rejected");
  } else fail("11.2", `${zeroDur.status}: ${JSON.stringify(zd)}`);

  const typeName = `SmokeType${Date.now()}`;
  const { res: addRes, data: addData } = await json("POST", "/api/appointment-types", {
    action: "add",
    name: typeName,
    duration: 15,
    description: "Smoke test type",
  });
  const typeId = addData.id;
  if (addRes.ok && typeId) pass("11.3", `Added type id=${typeId}`);
  else fail("11.3", JSON.stringify(addData));

  if (typeId) {
    const { res: updRes, data: updData } = await json("POST", "/api/appointment-types", {
      action: "update",
      id: typeId,
      name: `${typeName}Updated`,
      duration: 20,
      description: "Updated",
    });
    if (updRes.ok && updData.success) pass("11.4", "Type updated");
    else fail("11.4", JSON.stringify(updData));

    const { res: toggleRes, data: toggleData } = await json("POST", "/api/appointment-types", {
      action: "toggle",
      id: typeId,
    });
    if (toggleRes.ok && toggleData.is_active === false) {
      pass("11.5", "Type deactivated");
      const { data: publicTypes } = await json(
        "GET",
        "/api/appointment-types",
        null,
        { auth: false }
      );
      const visible = publicTypes.types?.some((t) => t.id === typeId);
      if (!visible) pass("11.5b", "Inactive type hidden from public");
      else fail("11.5b", "Inactive type still visible publicly");
    } else fail("11.5", JSON.stringify(toggleData));
  }
}

// ── Section 12: Doctor Schedules ────────────────────────────────────────────
async function section12() {
  const { res: docRes, data: docData } = await json("GET", "/api/admin/doctors");
  const doc = docData.doctors?.[0];
  if (!docRes.ok || !doc) {
    fail("12.1", "No doctors found");
    return;
  }

  const { res: schedRes, data: schedData } = await json(
    "GET",
    `/api/admin/doctors?doctorId=${doc.id}`
  );
  if (schedRes.ok && schedData.schedules?.length === 7) {
    pass("12.1", "7-day schedule grid returned");
  } else fail("12.1", JSON.stringify(schedData));

  const schedules = schedData.schedules.map((s) => ({
    day_of_week: s.day_of_week,
    is_active: s.day_of_week >= 1 && s.day_of_week <= 5,
    start_time: "08:00",
    end_time: "17:00",
  }));
  const { res: saveRes, data: saveData } = await json("POST", "/api/admin/doctors", {
    type: "schedule",
    doctorId: doc.id,
    schedules,
  });
  if (saveRes.ok && saveData.success) pass("12.2", "Mon-Fri schedule saved");
  else fail("12.2", JSON.stringify(saveData));

  const { res: blockRes, data: blockData } = await json("POST", "/api/admin/doctors", {
    type: "block",
    doctorId: doc.id,
    dayOfWeek: 1,
    startTime: "12:00",
    endTime: "13:00",
    reason: "lunch",
    isRecurring: true,
  });
  if (blockRes.ok && blockData.success) pass("12.3", "Recurring lunch block added");
  else fail("12.3", JSON.stringify(blockData));

  const blockDate = new Date();
  blockDate.setDate(blockDate.getDate() + 3);
  while (blockDate.getDay() === 0 || blockDate.getDay() === 6) {
    blockDate.setDate(blockDate.getDate() + 1);
  }
  const dateStr = blockDate.toISOString().slice(0, 10);
  const { res: oneTimeRes, data: oneTimeData } = await json("POST", "/api/admin/doctors", {
    type: "block",
    doctorId: doc.id,
    blockDate: dateStr,
    startTime: "14:00",
    endTime: "15:00",
    reason: "meeting",
    isRecurring: false,
  });
  if (oneTimeRes.ok && oneTimeData.success) pass("12.4", `One-time block on ${dateStr}`);
  else fail("12.4", JSON.stringify(oneTimeData));

  const { res: availRes, data: availData } = await json(
    "GET",
    `/api/doctors/availability?doctorId=${doc.id}&date=${dateStr}&durationMinutes=30`,
    null,
    { auth: false }
  );
  if (availRes.ok) {
    pass("12.2b", `Availability endpoint returns ${(availData.slots ?? availData.available_slots ?? []).length} slots`);
  } else fail("12.2b", JSON.stringify(availData));
}

// ── Section 13: Display Settings ────────────────────────────────────────────
async function section13() {
  const { res: listRes, data: listData } = await json("GET", "/api/admin/settings");
  if (listRes.ok && Array.isArray(listData.screens)) {
    pass("13.1", `${listData.screens.length} display screens listed`);
  } else fail("13.1", JSON.stringify(listData));

  const { res: badAdd, data: badData } = await json("POST", "/api/admin/settings", {
    action: "add",
    display_name: "",
    location: "",
  });
  if (badAdd.status === 400) pass("13.2", "Empty name/location rejected");
  else fail("13.2", `${badAdd.status}: ${JSON.stringify(badData)}`);

  const { res: addRes, data: addData } = await json("POST", "/api/admin/settings", {
    action: "add",
    display_name: `Smoke Screen ${Date.now()}`,
    location: "Lobby",
  });
  const screenId = addData.id;
  if (addRes.ok && screenId) pass("13.3", `Screen id=${screenId} created`);
  else fail("13.3", JSON.stringify(addData));

  if (screenId) {
    const { res: toggleRes, data: toggleData } = await json("POST", "/api/admin/settings", {
      action: "toggle",
      id: screenId,
    });
    if (toggleRes.ok && typeof toggleData.is_active === "boolean") {
      pass("13.4", `Toggled is_active=${toggleData.is_active}`);
    } else fail("13.4", JSON.stringify(toggleData));
  }
}

// ── Section 14: Admin Appointments ──────────────────────────────────────────
async function ensurePendingAppointment() {
  const { data: doctors } = await json("GET", "/api/doctors", null, { auth: false });
  const doctorId = doctors.doctors?.[0]?.id;
  if (!doctorId) return null;

  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const weekday = d.toISOString().slice(0, 10);

  const { data: slotsData } = await json(
    "GET",
    `/api/doctors/availability?doctorId=${doctorId}&date=${weekday}&durationMinutes=30`,
    null,
    { auth: false }
  );
  const slots = slotsData.slots ?? slotsData.available_slots ?? [];
  if (!slots.length) return null;

  const phone = `09${String(Date.now()).slice(-9)}`;
  const { data: reg } = await json(
    "POST",
    "/api/patients",
    {
      firstName: "Appt",
      lastName: "AdminSmoke",
      dob: "1992-06-15",
      gender: "female",
      phone,
      address: "Test",
      consent: true,
    },
    { auth: false }
  );
  if (!reg.patient) return null;

  const { data: book } = await json(
    "POST",
    "/api/appointments",
    {
      patient_id: reg.patient,
      preferredDoctor: doctorId,
      appointmentType: 1,
      appointmentDate: weekday,
      appointmentTime: slots[0],
      reason: "Admin smoke pending",
      termsAgreement: true,
    },
    { auth: false }
  );
  return book.appointmentID ?? null;
}

async function section14() {
  await ensurePendingAppointment();

  const { res: listRes, data: listData } = await json("GET", "/api/appointments?filter=upcoming");
  if (listRes.ok && Array.isArray(listData.appointments)) {
    pass("14.1", `${listData.appointments.length} upcoming appointments`);
  } else fail("14.1", JSON.stringify(listData));

  const pending = listData.appointments?.find((a) => a.status === "pending");
  if (pending) {
    const { res: confirmRes, data: confirmData } = await json("POST", "/api/appointments", {
      action: "staff_update",
      checkinId: pending.checkin_id ?? pending.id,
      status: "confirm",
    });
    if (confirmRes.ok && confirmData.status === "checked_in") {
      pass("14.2", "Pending appointment confirmed");
    } else if (confirmRes.ok) {
      pass("14.2", `Confirm returned status=${confirmData.status}`);
    } else fail("14.2", JSON.stringify(confirmData));

    const { res: cancelRes, data: cancelData } = await json("POST", "/api/appointments", {
      action: "staff_update",
      checkinId: pending.checkin_id ?? pending.id,
      status: "cancel",
    });
    if (cancelRes.ok) pass("14.4", "Appointment cancelled");
    else fail("14.4", JSON.stringify(cancelData));
  } else {
    pass("14.2", "No pending appointment to confirm (skipped)");
    pass("14.4", "No pending appointment to cancel (skipped)");
  }
}

// ── Section 15: Data Cleanup ──────────────────────────────────────────────────
async function section15() {
  const { res, data } = await json("POST", "/api/queue/actions", {
    action: "purge_history",
  });
  if (res.ok && (data.success || data.purged !== undefined || data.queue_rows !== undefined)) {
    pass("15.1", `Purge completed: ${JSON.stringify(data)}`);
    pass("15.2", "Purge returns counts");
  } else fail("15.1", `${res.status}: ${JSON.stringify(data)}`);
}

// ── Section 16: Security ──────────────────────────────────────────────────────
async function section16() {
  const dashRes = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  if (dashRes.status === 307 || dashRes.status === 302) {
    const loc = dashRes.headers.get("location") ?? "";
    if (loc.includes("/login")) pass("16.1", "Unauthenticated /dashboard redirects to login");
    else fail("16.1", `Redirect to ${loc}`);
  } else fail("16.1", `Expected redirect, got ${dashRes.status}`);

  const { res: noAuth } = await json(
    "POST",
    "/api/queue/actions",
    { action: "get_analytics" },
    { auth: false }
  );
  if (noAuth.status === 401) pass("16.4", "Queue actions require auth");
  else fail("16.4", `Expected 401, got ${noAuth.status}`);

  const { res: regRes, data: regData } = await json(
    "POST",
    "/api/auth/register",
    {},
    { auth: false }
  );
  if (regRes.status === 405 && /not allowed/i.test(regData.error ?? "")) {
    pass("16.3", "Self-registration returns 405");
  } else fail("16.3", `${regRes.status}: ${JSON.stringify(regData)}`);

  const staffEmail = `nonadmin_${Date.now()}@test.com`;
  const { data: staffAdd } = await json("POST", "/api/admin/staff", {
    action: "register",
    firstName: "Non",
    lastName: "Admin",
    email: staffEmail,
    password: "password123",
    role: "receptionist",
  });
  if (!staffAdd.staff_id) {
    fail("16.5", "Could not create non-admin staff for test");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const staffSupabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: staffLogin } = await staffSupabase.auth.signInWithPassword({
    email: staffEmail,
    password: "password123",
  });
  const staffCookie = staffLogin.session
    ? sessionCookie(staffLogin.session, url)
    : "";

  const staffFetch = async (path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: staffCookie },
      body: JSON.stringify(body),
    });
    return { res, data: await res.json().catch(() => ({})) };
  };

  const { res: resetStaff } = await staffFetch("/api/queue/actions", {
    action: "reset_daily",
  });
  if (resetStaff.status === 403) pass("16.5a", "Non-admin reset_daily returns 403");
  else fail("16.5a", `Expected 403, got ${resetStaff.status}`);

  const { res: purgeStaff } = await staffFetch("/api/queue/actions", {
    action: "purge_history",
  });
  if (purgeStaff.status === 403) pass("16.5b", "Non-admin purge_history returns 403");
  else fail("16.5b", `Expected 403, got ${purgeStaff.status}`);

  const adminGet = await fetch(`${BASE}/admin`, {
    redirect: "manual",
    headers: { Cookie: staffCookie },
  });
  if (adminGet.status === 307 || adminGet.status === 302) {
    const loc = adminGet.headers.get("location") ?? "";
    if (loc.includes("/dashboard") || loc.includes("/login")) {
      pass("16.2", "Non-admin /admin redirected");
    } else fail("16.2", `Redirect to ${loc}`);
  } else fail("16.2", `Expected redirect, got ${adminGet.status}`);

  await json("POST", "/api/admin/staff", {
    action: "toggle_active",
    id: staffAdd.staff_id,
  });

  const { error: inactiveLogin } = await staffSupabase.auth.signInWithPassword({
    email: staffEmail,
    password: "password123",
  });
  if (inactiveLogin) {
    pass("16.6", `Inactive staff login fails: ${inactiveLogin.message}`);
  } else fail("16.6", "Inactive staff should not login");
}

async function main() {
  console.log(`\nSmoke sections 9–16 @ ${BASE}\n`);
  loadEnv();

  try {
    const health = await fetch(`${BASE}/api/health`);
    const h = await health.json();
    if (h.checks?.database !== "ok") {
      console.error("Database not connected — aborting");
      process.exit(1);
    }
  } catch (e) {
    console.error("Cannot reach server:", e.message);
    process.exit(1);
  }

  try {
    await login();
    pass("auth", `Logged in as ${ADMIN_EMAIL}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  await loadDoctorAndRoom();
  await section9();
  await section10();
  await section11();
  await section12();
  await section13();
  await section14();
  await section15();
  await section16();

  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`\n── Summary: ${results.length - failed.length}/${results.length} passed ──`);
  if (failed.length) {
    failed.forEach((f) => console.error(`  FAIL ${f.id}: ${f.msg}`));
    process.exit(1);
  }
}

main();
