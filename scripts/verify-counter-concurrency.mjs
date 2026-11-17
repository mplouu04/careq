/**
 * Concurrent next_counter stress test (two clinics × 50 parallel calls).
 *
 * Requires a Supabase **branch** where clinic-scoped counters are independent
 * (typically after Stage C). See docs/conflict-targets.md.
 *
 * Env (do not commit secrets):
 *   ALLOW_BRANCH_ONLY=1              — required gate
 *   PRODUCTION_PROJECT_REF           — production Supabase project ref (required)
 *   VERIFY_SUPABASE_URL              — branch project URL (must NOT contain prod ref)
 *   VERIFY_SUPABASE_SERVICE_ROLE_KEY
 *   VERIFY_BRANCH_DATABASE_URL       — optional; if set, must NOT contain prod ref
 *   VERIFY_CLINIC_A_ID / VERIFY_CLINIC_B_ID — optional
 *
 * Run:
 *   ALLOW_BRANCH_ONLY=1 PRODUCTION_PROJECT_REF=xxxx \
 *     VERIFY_SUPABASE_URL=... VERIFY_SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/verify-counter-concurrency.mjs
 */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_CLINIC_A = "a0000000-0000-4000-8000-000000000001";
const PARALLEL = 50;
const COUNTER_DATE = "2099-12-15";
const KEY = `VERIFY_CONC_${Date.now()}`;

function refuse(msg) {
  console.error("REFUSED:", msg);
  process.exit(1);
}

if (process.env.ALLOW_BRANCH_ONLY !== "1") {
  refuse("Set ALLOW_BRANCH_ONLY=1 to run against a branch database only.");
}

const prodRef = process.env.PRODUCTION_PROJECT_REF;
if (!prodRef || !String(prodRef).trim()) {
  refuse("Set PRODUCTION_PROJECT_REF to your production Supabase project ref.");
}

const url = process.env.VERIFY_SUPABASE_URL;
const key = process.env.VERIFY_SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.VERIFY_BRANCH_DATABASE_URL ?? "";

if (!url || !key) {
  refuse("Set VERIFY_SUPABASE_URL and VERIFY_SUPABASE_SERVICE_ROLE_KEY (branch).");
}

const haystacks = [url, dbUrl].filter(Boolean);
for (const h of haystacks) {
  if (h.includes(prodRef)) {
    refuse(
      `URL looks like production (contains PRODUCTION_PROJECT_REF=${prodRef}). Use a branch URL.`
    );
  }
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureClinicB(id) {
  const { data: existing } = await supabase
    .from("clinics")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existing?.id) return id;

  const { error } = await supabase.from("clinics").insert({
    id,
    slug: "verify-concurrency-b",
    name: "Verify Concurrency B",
    is_active: true,
  });
  if (error) {
    throw new Error(`Failed to insert clinic B: ${error.message}`);
  }
  return id;
}

async function nextCounter(clinicId) {
  const { data, error } = await supabase.rpc("next_counter", {
    p_date: COUNTER_DATE,
    p_key: KEY,
    p_clinic_id: clinicId,
  });
  if (error) throw new Error(error.message);
  return data;
}

function assertUnique(label, values) {
  const set = new Set(values);
  if (set.size !== values.length) {
    const sorted = [...values].sort((a, b) => a - b);
    throw new Error(
      `${label}: expected ${values.length} unique values, got ${set.size} (${sorted.join(",")})`
    );
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (min !== 1 || max !== values.length) {
    throw new Error(
      `${label}: expected contiguous 1..${values.length}, got min=${min} max=${max}`
    );
  }
}

async function main() {
  const clinicA = process.env.VERIFY_CLINIC_A_ID ?? DEFAULT_CLINIC_A;
  const clinicB =
    process.env.VERIFY_CLINIC_B_ID ?? "b0000000-0000-4000-8000-000000000099";

  await ensureClinicB(clinicB);

  console.log(`Firing ${PARALLEL} parallel next_counter per clinic`);
  console.log(`  date=${COUNTER_DATE} key=${KEY}`);
  console.log(`  A=${clinicA}`);
  console.log(`  B=${clinicB}`);

  const [resultsA, resultsB] = await Promise.all([
    Promise.all(Array.from({ length: PARALLEL }, () => nextCounter(clinicA))),
    Promise.all(Array.from({ length: PARALLEL }, () => nextCounter(clinicB))),
  ]);

  assertUnique("clinic A", resultsA);
  assertUnique("clinic B", resultsB);

  console.log("PASS: no duplicate counter values per clinic; ranges 1..50 each");
}

main().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  console.error(
    "If this fails on Stage A with a unique/PK violation across clinics, apply Stage C first (or drop legacy daily_counters PK on the branch)."
  );
  process.exit(1);
});
