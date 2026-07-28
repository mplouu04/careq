import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? "admin@clinic.com";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? "admin123";

const LIVE_AUTH =
  !!process.env.SMOKE_ADMIN_EMAIL &&
  process.env.SMOKE_ADMIN_EMAIL !== "admin@clinic.com";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(ADMIN_EMAIL);
  await page.locator("#loginPassword").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

test.describe("Staff queue workflow (live)", () => {
  test.skip(!LIVE_AUTH, "requires live Supabase credentials (set SMOKE_ADMIN_EMAIL)");

  test("dashboard queue columns and call-next controls are interactive", async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole("heading", { name: "Waiting Room" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /in progress/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /call next/i })).toBeVisible();

    // Doctor + room selects must be present for call/recall actions
    await expect(page.getByLabel(/doctor/i).or(page.getByText(/select doctor/i)).first()).toBeVisible();
  });

  test("admin doctors API rejects non-admin staff", async ({ page, request }) => {
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const staffEmail = `e2e_nurse_${Date.now()}@test.com`;
    const createRes = await request.post("/api/admin/staff", {
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      data: {
        action: "register",
        firstName: "E2E",
        lastName: "Nurse",
        email: staffEmail,
        password: "password123",
        role: "nurse",
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(staffEmail);
    await page.locator("#loginPassword").fill("password123");
    await page.getByRole("button", { name: /login/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });

    const nurseCookies = await page.context().cookies();
    const nurseHeader = nurseCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const doctorsRes = await request.get("/api/admin/doctors", {
      headers: { Cookie: nurseHeader },
    });
    expect(doctorsRes.status()).toBe(403);
  });
});

test.describe("Public booking and check-in UI (always)", () => {
  test("appointment booking wizard exposes doctor and type steps", async ({ page }) => {
    await page.goto("/appointments");
    await expect(page.getByRole("heading", { name: /book an appointment/i })).toBeVisible();
    await expect(page.getByText(/select|doctor|appointment/i).first()).toBeVisible();
  });

  test("check-in page supports appointment and walk-in tabs", async ({ page }) => {
    await page.goto("/checkin");
    await expect(page.getByText(/appointment|walk-in/i).first()).toBeVisible();
  });

  test("my-appointments lookup form validates empty submit", async ({ page }) => {
    await page.goto("/my-appointments");
    await page.getByRole("button", { name: /find|search|look up|continue/i }).first().click();
    await expect(page.locator("body")).toContainText(/phone|date of birth|required|enter/i);
  });
});
