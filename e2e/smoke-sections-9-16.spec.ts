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

test.describe.configure({ mode: "serial" });

test.describe("Smoke §9 — Dashboard", () => {
  test.skip(!LIVE_AUTH, "requires live Supabase credentials (set SMOKE_ADMIN_EMAIL)");
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("9.1 dashboard loads analytics and queue columns", async ({ page }) => {
    await expect(page.getByText(/^served$/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting Room" })).toBeVisible();
    await expect(page.getByRole("button", { name: /call next/i })).toBeVisible();
  });

  test("9.8 admin sees reset queue control", async ({ page }) => {
    await expect(page.getByRole("button", { name: /reset queue/i })).toBeVisible();
  });
});

test.describe("Smoke §10–15 — Admin panel", () => {
  test.skip(!LIVE_AUTH, "requires live Supabase credentials (set SMOKE_ADMIN_EMAIL)");
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await page.waitForURL(/\/admin/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible();
  });

  test("10.1 staff tab lists staff", async ({ page }) => {
    await page.getByRole("button", { name: /^staff$/i }).click();
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
  });

  test("10.3 short password blocked on add staff", async ({ page }) => {
    await page.getByRole("button", { name: /^staff$/i }).click();
    await page.locator('input[name="firstName"]').fill("Short");
    await page.locator('input[name="lastName"]').fill("Pass");
    await page.locator('input[name="email"]').fill(`shortpw_${Date.now()}@test.com`);
    await page.locator('input[name="password"]').fill("short");
    await page.getByRole("button", { name: /create staff account/i }).click();
    const password = page.locator('input[name="password"]');
    await expect(password).toHaveJSProperty("validity.valid", false);
  });

  test("11.1 appointment types tab visible", async ({ page }) => {
    await page.getByRole("button", { name: /appointment types/i }).click();
    await expect(page.getByRole("heading", { name: /appointment types/i })).toBeVisible();
  });

  test("13.1 display screens tab lists screens", async ({ page }) => {
    await page.getByRole("button", { name: /display screens/i }).click();
    await expect(page.getByRole("heading", { name: /add display screen/i })).toBeVisible();
  });

  test("14.1 appointments tab shows upcoming list", async ({ page }) => {
    await page.getByRole("button", { name: /^appointments$/i }).click();
    await expect(page.getByRole("heading", { name: /appointments/i })).toBeVisible();
  });

  test("15.1 data tab has purge control", async ({ page }) => {
    await page.getByRole("button", { name: /^data$/i }).click();
    await expect(page.getByRole("button", { name: /purge old records/i })).toBeVisible();
  });
});

test.describe("Smoke §16 — Security", () => {
  test("16.1 unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("16.2 non-admin cannot access admin panel", async ({ page, request }) => {
    test.skip(!LIVE_AUTH, "requires live Supabase credentials (set SMOKE_ADMIN_EMAIL)");
    const staffEmail = `e2e_staff_${Date.now()}@test.com`;
    const staffPassword = "password123";

    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const createRes = await request.post("/api/admin/staff", {
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      data: {
        action: "register",
        firstName: "E2E",
        lastName: "Staff",
        email: staffEmail,
        password: staffPassword,
        role: "receptionist",
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(staffEmail);
    await page.locator("#loginPassword").fill(staffPassword);
    await page.getByRole("button", { name: /login/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });

    await page.goto("/admin");
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).not.toContain("/admin");
  });
});
