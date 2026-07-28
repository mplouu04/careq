import { test, expect, type Page } from "@playwright/test";

/**
 * Regression test for the "hours-long delay after doctor toggle" bug — see
 * plan doctor_activation_delay_rca.
 *
 * We can't reliably drive Supabase Realtime from Playwright, so this test
 * exercises the CLIENT-SIDE polling / focus-refetch fallback path (plan H3):
 *   1. Booking page loads with two ACTIVE doctors.
 *   2. Server-side state changes (Dr. Cruz -> inactive) via a route interceptor.
 *   3. We fire visibilitychange (which the booking hook listens to) instead of
 *      waiting the full 60s poll interval. The doctor list should refetch and
 *      the Cruz card should become disabled — no manual page reload.
 *
 * If someone ever regresses the invalidation wiring or removes the
 * refetchInterval / refetchOnWindowFocus / visibilitychange handler, this
 * test will fail because the card state will not update.
 */

const DOCTORS_ACTIVE = [
  { id: "doc-santos", first_name: "Ana", last_name: "Santos", is_active: true },
  { id: "doc-cruz", first_name: "Ben", last_name: "Cruz", is_active: true },
];

const DOCTORS_ONE_INACTIVE = [
  { id: "doc-santos", first_name: "Ana", last_name: "Santos", is_active: true },
  { id: "doc-cruz", first_name: "Ben", last_name: "Cruz", is_active: false },
];

const APPT_TYPES = [
  { id: "1", name: "Consultation", duration: 30 },
  { id: "2", name: "Follow-up", duration: 15 },
];

type MutableState = { doctors: typeof DOCTORS_ACTIVE };

async function mockCatalog(page: Page, state: MutableState) {
  await page.route(/\/api\/doctors(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store" },
      body: JSON.stringify({ success: true, doctors: state.doctors }),
    });
  });

  await page.route(/\/api\/appointment-types/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, types: APPT_TYPES }),
    });
  });

  // Silence unrelated requests so the page settles quickly.
  await page.route(/\/api\/doctors\/availability/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, available_slots: [] }),
    });
  });
}

test.describe("doctor activation propagates to /appointments without reload", () => {
  test("visibilitychange triggers a refetch after a server-side deactivate", async ({
    page,
  }) => {
    const state: MutableState = { doctors: [...DOCTORS_ACTIVE] };
    await mockCatalog(page, state);

    await page.goto("/appointments");

    const santos = page.getByRole("button", { name: /dr\.\s*ana santos/i });
    const cruz = page.getByRole("button", { name: /dr\.\s*ben cruz/i });

    await expect(santos).toBeVisible();
    await expect(cruz).toBeVisible();
    await expect(santos).toBeEnabled();
    await expect(cruz).toBeEnabled();

    // Server toggles Ben Cruz to inactive.
    state.doctors = [...DOCTORS_ONE_INACTIVE];

    // Simulate the user coming back to the tab (visibilitychange handler on
    // useAppointmentBookingCatalog invalidates the doctors query). This is
    // the shortest path to force a refetch without waiting 60s for the
    // refetchInterval fallback.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(cruz).toBeDisabled({ timeout: 10_000 });
    await expect(santos).toBeEnabled();
  });

  test("visibilitychange surfaces a server-side reactivate", async ({ page }) => {
    const state: MutableState = { doctors: [...DOCTORS_ONE_INACTIVE] };
    await mockCatalog(page, state);

    await page.goto("/appointments");

    const cruz = page.getByRole("button", { name: /dr\.\s*ben cruz/i });
    await expect(cruz).toBeDisabled();

    state.doctors = [...DOCTORS_ACTIVE];

    // Same trigger as the deactivate case: the booking hook's own
    // visibilitychange handler invalidates the doctors query. TanStack Query
    // v5's focus manager only subscribes to document.visibilitychange (not a
    // synthetic window `focus` event), so use the reliable path here too.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(cruz).toBeEnabled({ timeout: 10_000 });
  });
});
