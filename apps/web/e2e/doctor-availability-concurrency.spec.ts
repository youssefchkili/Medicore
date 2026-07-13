import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/auth-helpers";
import { DOCTOR } from "./fixtures/accounts";
import { buildFutureSlot, formatTime } from "./fixtures/date-format";

/**
 * Regression test for a fixed bug in
 * apps/web/src/app/dashboard/doctor/availability/page.tsx: deleting two
 * different slots in quick succession used to risk one deletion's loading
 * state interfering with the other. Fixed via a `Set<string>` of
 * `deletingIds`.
 */
test.describe("Regression: doctor availability concurrent slot deletion", () => {
  test.setTimeout(2 * 60_000);

  test("deleting two slots in quick succession both succeed independently", async ({ page }) => {
    await loginAs(page, "doctor", DOCTOR.email, DOCTOR.password);
    await page.goto("/dashboard/doctor/availability");

    const slotA = buildFutureSlot(5, 6, 10, 30);
    const slotB = buildFutureSlot(5, 6, 50, 30);

    for (const slot of [slotA, slotB]) {
      await page.getByRole("button", { name: "Add Slot" }).first().click();
      await page.locator('input[type="date"]').fill(slot.dateIso);
      await page.locator('input[type="time"]').nth(0).fill(slot.startTimeInput);
      await page.locator('input[type="time"]').nth(1).fill(slot.endTimeInput);
      await page.getByRole("button", { name: "Add Slot" }).last().click();
      await expect(page.getByText("Add Availability Slot")).toHaveCount(0);
    }

    const rowA = page
      .locator("div.flex.flex-col.gap-2 > div")
      .filter({ hasText: `${formatTime(slotA.startDate)} – ${formatTime(slotA.endDate)}` });
    const rowB = page
      .locator("div.flex.flex-col.gap-2 > div")
      .filter({ hasText: `${formatTime(slotB.startDate)} – ${formatTime(slotB.endDate)}` });
    await expect(rowA).toBeVisible();
    await expect(rowB).toBeVisible();

    await page.route("**/availability/*", async (route) => {
      if (route.request().method() === "DELETE") {
        await new Promise((r) => setTimeout(r, 1000));
      }
      await route.continue();
    });

    await Promise.all([
      rowA.getByTitle("Delete slot").click(),
      rowB.getByTitle("Delete slot").click(),
    ]);

    // Both slots are removed from the list independently, without either
    // deletion getting stuck or clobbered by the other's loading state.
    await expect(
      page.getByText(`${formatTime(slotA.startDate)} – ${formatTime(slotA.endDate)}`)
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(
      page.getByText(`${formatTime(slotB.startDate)} – ${formatTime(slotB.endDate)}`)
    ).toHaveCount(0, { timeout: 10_000 });
  });
});
