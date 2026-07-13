import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/auth-helpers";
import { ADMIN } from "./fixtures/accounts";

/**
 * Regression test for the admin "Doctor Management" page
 * (apps/web/src/app/dashboard/admin/doctors/page.tsx): a doctor's status
 * must distinguish PENDING / ACTIVE / DEACTIVATED. Deactivating an ACTIVE
 * doctor must show a "DEACTIVATED" badge with a "Reactivate" button (not
 * "Approve", which is only for PENDING doctors); reactivating must return
 * them to "ACTIVE".
 *
 * Ridha Chkili (license TN-MED-12345) is a real, shared account — the test
 * restores his original status at the end regardless of outcome.
 */
test.describe("Regression: admin doctor status transitions", () => {
  test("deactivating an active doctor shows DEACTIVATED + Reactivate, and reactivating restores ACTIVE", async ({
    page,
  }) => {
    await loginAs(page, "admin", ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/admin/doctors");

    const search = page.getByPlaceholder("Search by name, specialty, license…");
    await search.fill("TN-MED-12345");

    const row = page.getByText("Dr. Ridha Chkili", { exact: true }).locator("../../..");
    await expect(row).toBeVisible({ timeout: 10_000 });

    const initiallyActive = await row.getByText("ACTIVE", { exact: true }).isVisible().catch(() => false);
    test.skip(!initiallyActive, "Dr. Ridha Chkili is not currently ACTIVE — skipping to avoid mutating unexpected state.");

    // ── Deactivate ──────────────────────────────────────────────────────
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row.getByText("DEACTIVATED", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(row.getByRole("button", { name: "Reactivate" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Approve" })).toHaveCount(0);

    // ── Reactivate (restore original state) ────────────────────────────
    await row.getByRole("button", { name: "Reactivate" }).click();
    await expect(row.getByText("ACTIVE", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(row.getByRole("button", { name: "Deactivate" })).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Best-effort safety net: ensure Ridha Chkili ends the run ACTIVE, in
    // case the main assertions above failed mid-toggle.
    const page = await (await browser.newContext()).newPage();
    try {
      await loginAs(page, "admin", ADMIN.email, ADMIN.password);
      await page.goto("/dashboard/admin/doctors");
      await page.getByPlaceholder("Search by name, specialty, license…").fill("TN-MED-12345");
      const row = page.getByText("Dr. Ridha Chkili", { exact: true }).locator("../../..");
      const reactivateBtn = row.getByRole("button", { name: "Reactivate" });
      if (await reactivateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await reactivateBtn.click();
        await expect(row.getByText("ACTIVE", { exact: true })).toBeVisible({ timeout: 10_000 });
      }
    } catch {
      // Non-fatal — this is a best-effort safety net only.
    } finally {
      await page.context().close();
    }
  });
});
