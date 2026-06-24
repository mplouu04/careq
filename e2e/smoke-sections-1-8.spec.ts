import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? "admin@clinic.com";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? "admin123";

const LIVE_AUTH =
  !!process.env.SMOKE_ADMIN_EMAIL &&
  process.env.SMOKE_ADMIN_EMAIL !== "admin@clinic.com";

test.describe("Smoke §1 — Registration", () => {
  test("1.1 visit fork shows returning and first-visit options", async ({ page }) => {
    await page.goto("/visit");
    await expect(page.getByRole("link", { name: /been here before/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /first visit/i })).toBeVisible();
  });

  test("1.2 first visit link opens registration wizard", async ({ page }) => {
    await page.goto("/visit");
    await page.getByRole("link", { name: /first visit/i }).click();
    await expect(page).toHaveURL(/\/registration/);
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /visit/i })).toBeVisible();
  });

  test("1.3 empty required fields block advance", async ({ page }) => {
    await page.goto("/registration");
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/complete all personal details/i)).toBeVisible();
  });

  test("1.4 ten-digit phone shows validation error", async ({ page }) => {
    await page.goto("/registration");
    await page.getByLabel(/first name/i).fill("Test");
    await page.getByLabel(/last name/i).fill("Patient");
    await page.getByLabel(/date of birth/i).fill("1990-01-01");
    await page.getByLabel(/gender/i).selectOption({ index: 1 });
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByLabel(/phone/i).fill("0912345678");
    await page.getByLabel(/area/i).fill("Test Area");
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/exactly 11 digits/i)).toBeVisible();
  });
});

test.describe("Smoke §2 — Patient Search", () => {
  test("2.1 identity verification form has date of birth and phone fields", async ({ page }) => {
    await page.goto("/patient-search");
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
  });

  test("2.2 submitting empty form shows validation error", async ({ page }) => {
    await page.goto("/patient-search");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/enter your date of birth/i)).toBeVisible();
  });
});

test.describe("Smoke §3 — Appointment Booking", () => {
  test("3.1 booking form loads for guest", async ({ page }) => {
    await page.goto("/appointments");
    await expect(page.getByRole("heading", { name: /book an appointment/i })).toBeVisible();
    await expect(page.getByLabel(/doctor/i).first()).toBeVisible();
  });

  test("3.3 calendar limits booking to 30 days ahead", async ({ page }) => {
    test.skip(!LIVE_AUTH, "requires live Supabase credentials (doctors list needs real DB)");
    await page.goto("/appointments");
    await page.getByRole("button", { name: /dr\./i }).first().click();
    await page.getByRole("button", { name: /general consultation/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/up to 30 days in advance/i)).toBeVisible();
  });
});

test.describe("Smoke §4 — Check-In", () => {
  test("4.1 appointment and walk-in tabs", async ({ page }) => {
    await page.goto("/checkin");
    await expect(page.getByRole("button", { name: /^appointment$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /walk-in/i })).toBeVisible();
  });

  test("4.2 walk-in tab disabled without verifyToken", async ({ page }) => {
    await page.goto("/checkin");
    await expect(page.getByRole("button", { name: /walk-in/i })).toBeDisabled();
  });
});

test.describe("Smoke §5 — Queue Status", () => {
  test("5.1 status lookup page with queue param support", async ({ page }) => {
    await page.goto("/status?queue=APPT-1");
    await expect(page.getByRole("button", { name: /check status|status/i })).toBeVisible();
    const input = page.locator('input[name="queue"], input[placeholder*="queue" i]').first();
    if (await input.isVisible()) {
      await expect(input).toHaveValue(/APPT/i);
    }
  });

  test("5.6 invalid queue number shows not found", async ({ page }) => {
    await page.goto("/status/INVALID-99999");
    await expect(page.getByText(/queue entry not found/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Smoke §7 — Queue Board", () => {
  test("7.1 TV board shows Now Serving and Upcoming", async ({ page }) => {
    await page.goto("/queue");
    await expect(page.getByRole("heading", { name: /now serving/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /upcoming/i })).toBeVisible();
  });

  test("7.5 clock displays current time", async ({ page }) => {
    await page.goto("/queue");
    const clock = page.locator('[data-testid="queue-clock"], time, .font-mono-careq').first();
    await expect(clock).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Smoke §8 — Staff Login", () => {
  test("8.1 login form only, no self-registration", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /staff portal/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
    await expect(page.getByText(/contact your clinic administrator/i)).toBeVisible();
    await expect(page.getByRole("tab", { name: /register/i })).toHaveCount(0);
  });

  test("8.2 wrong credentials show error", async ({ page }) => {
    test.skip(!LIVE_AUTH, "requires live Supabase credentials (auth error message needs real DB)");
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill("wrong@clinic.com");
    await page.locator("#loginPassword").fill("wrongpassword");
    await page.getByRole("button", { name: /login/i }).click();
    await expect(page.getByText(/incorrect or user not found/i)).toBeVisible({ timeout: 10000 });
  });

  test("8.3 correct credentials redirect to dashboard", async ({ page }) => {
    test.skip(!LIVE_AUTH, "requires live Supabase credentials (set SMOKE_ADMIN_EMAIL)");
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL);
    await page.locator("#loginPassword").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /login/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("8.4 logged-in user visiting /login redirects to dashboard", async ({ page }) => {
    test.skip(!LIVE_AUTH, "requires live Supabase credentials (set SMOKE_ADMIN_EMAIL)");
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL);
    await page.locator("#loginPassword").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /login/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.goto("/login");
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  });
});
