import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Static guardrails for the doctor activation propagation path.
 *
 * Runtime verification (that these SQL objects exist in the deployed database)
 * still requires running scripts/diagnose-doctor-realtime.sql against prod.
 * These tests only protect against source-level regressions.
 */

const ROOT = path.resolve(__dirname, "..");

function readMigration(name: string): string {
  return fs.readFileSync(
    path.join(ROOT, "supabase", "migrations", name),
    "utf8"
  );
}

describe("staff Realtime publication (H2 guardrail)", () => {
  it("migration 016 adds staff to supabase_realtime and sets REPLICA IDENTITY FULL", () => {
    const src = readMigration("016_staff_realtime.sql");
    expect(src).toMatch(
      /ALTER PUBLICATION supabase_realtime ADD TABLE staff\s*;/i
    );
    expect(src).toMatch(/ALTER TABLE staff REPLICA IDENTITY FULL\s*;/i);
  });
});

describe("auth.users trigger is INSERT-only (H5 guardrail)", () => {
  it("migration 021 drops on_auth_user_updated and rewrites handler as INSERT-only", () => {
    const src = readMigration("021_staff_trigger_insert_only.sql");

    expect(src).toMatch(/DROP TRIGGER IF EXISTS on_auth_user_updated ON auth\.users/i);
    expect(src).toMatch(
      /CREATE TRIGGER on_auth_user_created\s+AFTER INSERT ON auth\.users/i
    );
    // Belt-and-suspenders: the file MUST NOT create a trigger that fires on UPDATE.
    expect(src).not.toMatch(/CREATE TRIGGER[\s\S]+?BEFORE UPDATE ON auth\.users/i);
    expect(src).not.toMatch(/CREATE TRIGGER[\s\S]+?AFTER UPDATE ON auth\.users/i);
  });
});

describe("doctor list Realtime invalidation wiring", () => {
  it("booking catalog subscribes to the doctors broadcast topic", () => {
    const src = fs.readFileSync(
      path.join(
        ROOT,
        "components",
        "patient",
        "useAppointmentBookingCatalog.ts"
      ),
      "utf8"
    );
    expect(src).toMatch(/DOCTORS_BROADCAST_TOPIC/);
    expect(src).toMatch(/DOCTORS_BROADCAST_EVENT/);
    expect(src).toMatch(/refetchInterval:\s*60_000/);
    expect(src).toMatch(/refetchOnWindowFocus:\s*true/);
  });

  it("staff dashboard subscribes to the doctors broadcast topic", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "components", "staff", "DashboardQueue.tsx"),
      "utf8"
    );
    expect(src).toMatch(/DOCTORS_BROADCAST_TOPIC/);
    expect(src).toMatch(/DOCTORS_BROADCAST_EVENT/);
  });

  it("admin toggle mutation invalidates the public doctors list", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "components", "admin", "AdminPanel.tsx"),
      "utf8"
    );
    expect(src).toMatch(
      /toggleStaffMutation[\s\S]{0,1500}queryKeys\.doctors\.list\(\)/
    );
  });

  it("toggleStaffActive broadcasts a doctors-changed event when the row is a doctor", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "lib", "services", "admin.service.ts"),
      "utf8"
    );
    expect(src).toMatch(/broadcastDoctorsChanged/);
    expect(src).toMatch(/current\.role === "doctor"/);
  });
});
