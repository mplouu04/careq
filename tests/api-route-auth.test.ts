import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const API_ROOT = path.resolve(__dirname, "../app/api");

type AuthKind =
  | "public"
  | "public-rate-limited"
  | "staff"
  | "cron"
  | "mixed";

/** Expected auth posture per route file (relative to app/api). */
const ROUTE_AUTH: Record<string, { kind: AuthKind; notes?: string }> = {
  "patient-verify/route.ts": { kind: "public-rate-limited", notes: "kiosk identity check" },
  "patients/route.ts": { kind: "mixed", notes: "GET staff-only; POST public registration" },
  "checkin/route.ts": { kind: "public-rate-limited" },
  "queue/public/route.ts": { kind: "mixed", notes: "GET public display; POST staff auto-complete" },
  "queue/route.ts": { kind: "mixed", notes: "GET ?ref= public; full list staff-only" },
  "appointments/route.ts": { kind: "mixed", notes: "patient lookup public; staff list protected" },
  "appointments/[ref]/route.ts": { kind: "public-rate-limited" },
  "doctors/route.ts": { kind: "public-rate-limited" },
  "doctors/availability/route.ts": { kind: "public-rate-limited" },
  "appointment-types/route.ts": { kind: "mixed", notes: "active types public; ?all=1 staff" },
  "rooms/route.ts": { kind: "mixed", notes: "active rooms public; ?all=1 staff" },
  "health/route.ts": { kind: "public-rate-limited" },
  "auth/register/route.ts": { kind: "public", notes: "always 405" },
  "push/subscribe/route.ts": {
    kind: "public-rate-limited",
    notes: "Web Push subscribe/unsubscribe for queue turn alerts",
  },
  "queue/analytics/route.ts": { kind: "staff" },
  "queue/actions/route.ts": { kind: "staff" },
  "queue/[id]/call/route.ts": { kind: "staff" },
  "queue/[id]/done/route.ts": { kind: "staff" },
  "queue/[id]/skip/route.ts": { kind: "staff" },
  "queue/[id]/recall/route.ts": { kind: "staff" },
  "queue/[id]/no-show/route.ts": { kind: "staff" },
  "admin/doctors/route.ts": { kind: "staff" },
  "admin/staff/route.ts": { kind: "staff" },
  "admin/settings/route.ts": { kind: "staff" },
  "cron/reminders/route.ts": { kind: "cron" },
  "cron/retention/route.ts": { kind: "cron" },
};

function listRouteFiles(dir: string, prefix = ""): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(full, rel));
    } else if (entry.name === "route.ts") {
      files.push(rel);
    }
  }
  return files.sort();
}

function readRoute(relativePath: string): string {
  return fs.readFileSync(path.join(API_ROOT, relativePath), "utf8");
}

describe("API route auth inventory", () => {
  const routeFiles = listRouteFiles(API_ROOT);

  it("documents every app/api route file", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    for (const file of routeFiles) {
      expect(ROUTE_AUTH[file], `missing auth classification for ${file}`).toBeDefined();
    }
    expect(Object.keys(ROUTE_AUTH).sort()).toEqual(routeFiles);
  });

  it("staff-only routes use withStaffAuth or requireStaff", () => {
    const staffOnly = Object.entries(ROUTE_AUTH)
      .filter(([, v]) => v.kind === "staff")
      .map(([k]) => k);

    for (const file of staffOnly) {
      const src = readRoute(file);
      const hasGuard =
        src.includes("withStaffAuth") || src.includes("requireStaff");
      expect(hasGuard, `${file} should require staff auth`).toBe(true);
    }
  });

  it("cron routes use verifyCronAuth", () => {
    const cronRoutes = Object.entries(ROUTE_AUTH)
      .filter(([, v]) => v.kind === "cron")
      .map(([k]) => k);

    for (const file of cronRoutes) {
      const src = readRoute(file);
      expect(src.includes("verifyCronAuth"), `${file} should verify cron auth`).toBe(true);
    }
  });

  it("public-rate-limited routes use withRateLimit or withPatientVerifyRateLimit", () => {
    const publicLimited = Object.entries(ROUTE_AUTH)
      .filter(([, v]) => v.kind === "public-rate-limited")
      .map(([k]) => k);

    for (const file of publicLimited) {
      const src = readRoute(file);
      const hasRateLimit =
        src.includes("withRateLimit") || src.includes("withPatientVerifyRateLimit");
      expect(hasRateLimit, `${file} should be rate-limited`).toBe(true);
    }
  });

  it("mixed routes protect staff-only branches", () => {
    const mixed = Object.entries(ROUTE_AUTH)
      .filter(([, v]) => v.kind === "mixed")
      .map(([k]) => k);

    for (const file of mixed) {
      const src = readRoute(file);
      const hasGuard =
        src.includes("withStaffAuth") || src.includes("requireStaff");
      expect(hasGuard, `${file} should gate staff branches`).toBe(true);
    }
  });
});

describe("public queue endpoint safety", () => {
  it("GET /api/queue/public does not return patient names or phone numbers", () => {
    const src = readRoute("queue/public/route.ts");
    expect(src).not.toMatch(/first_name|last_name|phone|date_of_birth/);
    expect(src).toMatch(/withRateLimit/);
  });

  it("GET /api/queue/public scopes by clinic_date and limits waiting rows", () => {
    const src = readRoute("queue/public/route.ts");
    expect(src).toMatch(/\.eq\("clinic_date", today\)/);
    expect(src).toMatch(/WAITING_BOARD_LIMIT/);
    expect(src).toMatch(/\.limit\(WAITING_BOARD_LIMIT\)/);
    expect(src).toMatch(/\.in\("status", \["in_progress", "called"\]\)/);
    expect(src).toMatch(/\.eq\("status", "waiting"\)/);
  });

  it("POST /api/queue/public requires staff session", () => {
    const src = readRoute("queue/public/route.ts");
    expect(src).toMatch(/requireStaff/);
    const postBlock = src.slice(src.indexOf("export async function POST"));
    expect(postBlock).toMatch(/requireStaff/);
  });
});
