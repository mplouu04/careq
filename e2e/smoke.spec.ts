import { test, expect } from "@playwright/test";

/**
 * Smoke tests aligned with docs/SMOKE_CHECKLIST.md public flows.
 * These verify page loads and key UI elements without requiring a live Supabase DB.
 */
test.describe("Public pages smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CAREQ|Care|Queue/i);
  });

  test("visit fork page shows registration options", async ({ page }) => {
    await page.goto("/visit");
    await expect(page.getByRole("link", { name: /first visit|registration/i })).toBeVisible();
  });

  test("registration page loads wizard", async ({ page }) => {
    await page.goto("/registration");
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
  });

  test("patient search page loads", async ({ page }) => {
    await page.goto("/patient-search");
    await expect(page.getByPlaceholder(/search|name|patient/i).first()).toBeVisible();
  });

  test("check-in page has appointment tab", async ({ page }) => {
    await page.goto("/checkin");
    await expect(page.getByText(/appointment|walk-in/i).first()).toBeVisible();
  });

  test("my appointments page has lookup form", async ({ page }) => {
    await page.goto("/my-appointments");
    await expect(page.locator('input[type="date"], input[name="dob"]').first()).toBeVisible();
  });

  test("queue status lookup page loads", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByRole("button", { name: /check status|status/i })).toBeVisible();
  });

  test("health API responds with status payload", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("checks");
  });
});

test.describe("Staff auth gate", () => {
  test("dashboard redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/login/);
    expect(page.url()).toContain("/login");
  });
});
