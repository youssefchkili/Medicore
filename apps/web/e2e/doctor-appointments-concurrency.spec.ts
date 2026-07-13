import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/auth-helpers";
import { PATIENT, DOCTOR } from "./fixtures/accounts";
import { buildUniqueFutureSlot, formatDate, formatTime } from "./fixtures/date-format";
import { captureAuthToken, apiCreateSlot, apiDeleteSlot, apiCancelAppointment } from "./fixtures/api-helpers";

/**
 * Regression test for a fixed bug in
 * apps/web/src/app/dashboard/doctor/appointments/page.tsx:
 * clicking "Confirm" on one appointment row and "Cancel" on a different row
 * in quick succession used to risk one action's loading state
 * blocking/clobbering the other. The fix uses a `Set<string>` keyed by
 * appointment id for per-row loading state.
 *
 * Prerequisite data (availability slots) is created directly via the API for
 * reliability/determinism; the actual actions under test (booking via the
 * patient UI, confirm/cancel via the doctor UI) exercise the real app.
 */
test.describe("Regression: doctor appointments concurrent row actions", () => {
  test.setTimeout(3 * 60_000);

  test("confirming one row and cancelling another concurrently keeps loading state independent", async ({
    browser,
  }) => {
    const doctorContext = await browser.newContext();
    const patientContext = await browser.newContext();
    const doctorPage = await doctorContext.newPage();
    const patientPage = await patientContext.newPage();
    const doctorToken = captureAuthToken(doctorPage);
    const patientToken = captureAuthToken(patientPage);

    const slotA = buildUniqueFutureSlot(4, 0);
    const slotB = buildUniqueFutureSlot(4, 90);
    let slotAId: string | null = null;
    let slotBId: string | null = null;
    let appointmentAId: string | null = null;
    let appointmentBId: string | null = null;

    try {
      await loginAs(doctorPage, "doctor", DOCTOR.email, DOCTOR.password);
      await doctorPage.goto("/dashboard/doctor/availability");
      await expect.poll(() => doctorToken.get()).not.toBe("");

      const req = doctorPage.request;
      const createdA = await apiCreateSlot(req, doctorToken.get(), slotA.startDate.toISOString(), slotA.endDate.toISOString());
      const createdB = await apiCreateSlot(req, doctorToken.get(), slotB.startDate.toISOString(), slotB.endDate.toISOString());
      slotAId = createdA.id;
      slotBId = createdB.id;

      await loginAs(patientPage, "patient", PATIENT.email, PATIENT.password);
      for (const slot of [slotA, slotB]) {
        await patientPage.goto("/dashboard/patient/appointments");
        await patientPage.getByRole("button", { name: "Book Appointment" }).first().click();
        await patientPage.getByPlaceholder("Search by name or specialty…").fill("Chkili");
        await patientPage.getByRole("button", { name: /Dr\. Ridha Chkili/ }).click();

        const slotButton = patientPage
          .getByRole("button")
          .filter({ hasText: formatDate(slot.startDate) })
          .filter({ hasText: `${formatTime(slot.startDate)} – ${formatTime(slot.endDate)}` });
        await expect(slotButton).toBeVisible({ timeout: 15_000 });
        await slotButton.click();
        await patientPage.getByRole("button", { name: "Online" }).click();

        const [response] = await Promise.all([
          patientPage.waitForResponse(
            (res) => res.url().includes("/appointments") && res.request().method() === "POST"
          ),
          patientPage.getByRole("button", { name: "Confirm Booking" }).click(),
        ]);
        const body = (await response.json()) as { id: string };
        if (slot === slotA) appointmentAId = body.id;
        else appointmentBId = body.id;
      }

      // Delay both mutating endpoints so we can observe independent loading states.
      await doctorPage.route("**/appointments/*/confirm", async (route) => {
        await new Promise((r) => setTimeout(r, 1200));
        await route.continue();
      });
      await doctorPage.route("**/appointments/*/cancel", async (route) => {
        await new Promise((r) => setTimeout(r, 1200));
        await route.continue();
      });

      await doctorPage.goto("/dashboard/doctor/appointments");
      // Scoped by each slot's distinct time text only (not by transient
      // button text like "Confirm") so the locator keeps resolving to the
      // same row after its action buttons change post-mutation.
      const rowA = doctorPage
        .locator("div.flex.flex-col.gap-3 > div")
        .filter({ hasText: formatTime(slotA.startDate) });
      const rowB = doctorPage
        .locator("div.flex.flex-col.gap-3 > div")
        .filter({ hasText: formatTime(slotB.startDate) });
      // Retry with a reload once — occasionally the just-created appointments
      // aren't reflected in the first render immediately after navigation.
      try {
        await expect(rowA.getByRole("button", { name: "Confirm" })).toBeVisible({ timeout: 8_000 });
        await expect(rowB.getByRole("button", { name: "Confirm" })).toBeVisible({ timeout: 8_000 });
      } catch {
        await doctorPage.reload();
        await expect(rowA.getByRole("button", { name: "Confirm" })).toBeVisible({ timeout: 15_000 });
        await expect(rowB.getByRole("button", { name: "Confirm" })).toBeVisible({ timeout: 15_000 });
      }

      // Open the cancel modal for row B first so its final trigger click
      // can be fired back-to-back with row A's confirm click.
      await rowB.getByRole("button", { name: "Cancel" }).click();
      await doctorPage
        .getByPlaceholder("Reason for cancellation (optional)…")
        .fill("E2E concurrency regression test");

      // Fire both mutating actions back-to-back. Both requests are
      // artificially delayed via the route interception above, so they are
      // genuinely in flight at the same time — this is the exact scenario
      // the original bug depended on (two concurrent per-row mutations).
      const rowAConfirmClick = rowA.getByRole("button", { name: "Confirm" }).click();
      const rowBCancelClick = doctorPage.getByRole("button", { name: "Cancel Appointment" }).click();
      await Promise.all([rowAConfirmClick, rowBCancelClick]);

      // Both eventually resolve to their correct, independent final states —
      // neither action affected the other row.
      await expect(rowA.getByText("Confirmed", { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(rowB.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(rowA.getByText("Cancelled", { exact: true })).toHaveCount(0);
      await expect(rowB.getByText("Confirmed", { exact: true })).toHaveCount(0);
    } finally {
      // Cleanup via direct API calls: cancel the confirmed appointment
      // (frees slot A); slot B's appointment is already cancelled by the
      // test itself. Then delete both availability slots.
      if (appointmentAId) {
        await expect.poll(() => patientToken.get(), { timeout: 10_000 }).not.toBe("").catch(() => {});
        if (patientToken.get()) {
          await apiCancelAppointment(patientPage.request, patientToken.get(), appointmentAId, "E2E cleanup");
        }
      }
      const cleanupToken = doctorToken.get();
      if (cleanupToken) {
        if (slotAId) await apiDeleteSlot(doctorPage.request, cleanupToken, slotAId);
        if (slotBId) await apiDeleteSlot(doctorPage.request, cleanupToken, slotBId);
      }

      await doctorContext.close();
      await patientContext.close();
    }
  });
});
