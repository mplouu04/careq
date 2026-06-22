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
    await expect(page.getByRole("tablist", { name: /lookup method/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /phone number/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /date of birth/i })).toBeVisible();
    await page.getByRole("tab", { name: /by reference/i }).click();
    await expect(page.getByRole("textbox", { name: /reference number/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /phone number/i })).toHaveCount(0);
  });

  test("queue status lookup page loads", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByRole("button", { name: /check status|status/i })).toBeVisible();
  });

  test("appointments booking page loads", async ({ page }) => {
    await page.goto("/appointments");
    await expect(page.getByRole("heading", { name: /book an appointment/i })).toBeVisible();
  });

  test("queue display board loads", async ({ page }) => {
    await page.goto("/queue");
    await expect(page.getByRole("heading", { name: /now serving/i })).toBeVisible();
  });

  test("login page loads staff sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /staff portal/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
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

  test("admin redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/login/);
    expect(page.url()).toContain("/login");
  });
});
