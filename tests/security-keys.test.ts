import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

const CLIENT_MARKERS = ['"use client"', "'use client'"];
const FORBIDDEN_IN_CLIENT = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "@/lib/supabase/admin",
  "createAdminClient",
];

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTsFiles(full, acc);
    } else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function isClientFile(source: string): boolean {
  return CLIENT_MARKERS.some((m) => source.includes(m));
}

describe("Supabase service-role key guardrails", () => {
  const sourceFiles = walkTsFiles(ROOT).filter(
    (f) => !f.includes(`${path.sep}tests${path.sep}`)
  );

  it("no client-bundled file imports createAdminClient or references service role key", () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const src = fs.readFileSync(file, "utf8");
      if (!isClientFile(src)) continue;

      for (const forbidden of FORBIDDEN_IN_CLIENT) {
        if (src.includes(forbidden)) {
          violations.push(`${path.relative(ROOT, file)}: contains ${forbidden}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("lib/supabase/client.ts only uses NEXT_PUBLIC Supabase env vars", () => {
    const clientPath = path.join(ROOT, "lib/supabase/client.ts");
    const src = fs.readFileSync(clientPath, "utf8");

    expect(src).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(src).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/createAdminClient/);
  });

  it("env schema keeps service role key server-only (no NEXT_PUBLIC prefix)", () => {
    const envPath = path.join(ROOT, "lib/env.ts");
    const src = fs.readFileSync(envPath, "utf8");

    expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it(".env.local.example does not expose service role as NEXT_PUBLIC", () => {
    const examplePath = path.join(ROOT, ".env.local.example");
    const src = fs.readFileSync(examplePath, "utf8");

    expect(src).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=/m);
    expect(src).not.toMatch(/NEXT_PUBLIC.*SERVICE_ROLE/);
  });

  it("admin client forces fetch cache: no-store (Next.js Data Cache footgun)", () => {
    const adminPath = path.join(ROOT, "lib/supabase/admin.ts");
    const src = fs.readFileSync(adminPath, "utf8");

    expect(src).toMatch(/global:\s*\{/);
    expect(src).toMatch(/cache:\s*["']no-store["']/);
  });
});
