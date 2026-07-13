import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/auth-helpers";
import { PATIENT, DOCTOR } from "./fixtures/accounts";
import { buildUniqueFutureSlot, formatDate, formatTime } from "./fixtures/date-format";
import { captureAuthToken, apiCreateSlot, apiDeleteSlot, apiCancelAppointment } from "./fixtures/api-helpers";

/**
 * Critical end-to-end journey:
 *   patient books an appointment with a doctor
 *   -> doctor confirms it
 *   -> patient completes the AI pre-diagnostic chat
 *
 * Uses two independent browser contexts (patient / doctor) so we can
 * interleave actions between both roles within a single test, mirroring a
 * real multi-user flow. The prerequisite availability slot is created via a
 * direct, authenticated API call (for determinism/reliability on the shared
 * Supabase project — the "Add Slot" UI form itself is separately covered by
 * doctor-availability-concurrency.spec.ts); booking, confirming, and the AI
 * chat are all driven through the real UI.
 */
test.describe("Critical flow: booking -> confirmation -> AI pre-diagnostic chat", () => {
  test.setTimeout(8 * 60_000); // AI cold-start (embedding model download) can take several minutes

  test("patient books, doctor confirms, patient completes AI chat", async ({ browser }) => {
    const doctorContext = await browser.newContext();
    const patientContext = await browser.newContext();
    const doctorPage = await doctorContext.newPage();
    const patientPage = await patientContext.newPage();
    const doctorToken = captureAuthToken(doctorPage);
    const patientToken = captureAuthToken(patientPage);

    const slot = buildUniqueFutureSlot(3);
    let slotId: string | null = null;
    let createdAppointmentId: string | null = null;

    try {
      // ── 1. Doctor: create a fresh availability slot (via API for reliability) ──
      await test.step("Doctor has a fresh availability slot", async () => {
        await loginAs(doctorPage, "doctor", DOCTOR.email, DOCTOR.password);
        await doctorPage.goto("/dashboard/doctor/availability");
        await expect.poll(() => doctorToken.get()).not.toBe("");

        const created = await apiCreateSlot(
          doctorPage.request,
          doctorToken.get(),
          slot.startDate.toISOString(),
          slot.endDate.toISOString()
        );
        slotId = created.id;

        // Sanity-check it's visible in the doctor's own UI.
        await doctorPage.reload();
        await expect(
          doctorPage.getByText(`${formatTime(slot.startDate)} – ${formatTime(slot.endDate)}`)
        ).toBeVisible({ timeout: 10_000 });
      });

      // ── 2. Patient: book the appointment with that exact slot ───────────
      await test.step("Patient books an appointment with the doctor", async () => {
        await loginAs(patientPage, "patient", PATIENT.email, PATIENT.password);
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
        await patientPage
          .getByPlaceholder("Describe your reason for the visit…")
          .fill("E2E test booking — mild recurring headache, requesting neurology consult.");

        const [response] = await Promise.all([
          patientPage.waitForResponse(
            (res) => res.url().includes("/appointments") && res.request().method() === "POST"
          ),
          patientPage.getByRole("button", { name: "Confirm Booking" }).click(),
        ]);
        const body = (await response.json()) as { id: string };
        createdAppointmentId = body.id;
        expect(createdAppointmentId).toBeTruthy();

        // Booking modal closes and the appointment now shows as Scheduled.
        await expect(patientPage.getByText("Book Appointment", { exact: true })).toBeVisible();
        await expect(patientPage.getByText("Scheduled").first()).toBeVisible();
      });

      // ── 3. Doctor: confirm the newly booked appointment ──────────────────
      await test.step("Doctor confirms the appointment", async () => {
        await doctorPage.goto("/dashboard/doctor/appointments");

        const timeText = formatTime(slot.startDate);
        const row = doctorPage
          .locator("div.flex.flex-col.gap-3 > div")
          .filter({ hasText: timeText })
          .filter({ hasText: "Confirm" });
        await expect(row).toBeVisible({ timeout: 15_000 });

        await row.getByRole("button", { name: "Confirm" }).click();
        await expect(row.getByText("Confirmed", { exact: true })).toBeVisible({ timeout: 10_000 });
      });

      // ── 4. Patient: run the AI pre-diagnostic chat to completion ────────
      await test.step("Patient completes the AI pre-diagnostic chat", async () => {
        await patientPage.goto("/dashboard/patient/chat");

        await expect(patientPage.getByText("Connected")).toBeVisible({ timeout: 30_000 });

        await sendChatMessage(patientPage, "I have had a mild headache for two days");

        // AI is expected to ask a clarifying follow-up about symptom progression.
        await expect(
          patientPage.getByText(/getting better, worse, or staying the same/i)
        ).toBeVisible({ timeout: 5 * 60_000 }); // generous timeout for cold RAG/embedding-model start

        await sendChatMessage(patientPage, "It has been staying about the same, mild but constant");

        await expect(
          patientPage.getByText(/I have collected your symptoms/i)
        ).toBeVisible({ timeout: 5 * 60_000 });

        await expect(
          patientPage.getByText(/Your pre-diagnostic report is ready/i)
        ).toBeVisible({ timeout: 60_000 });
        await expect(patientPage.getByText("Session complete")).toBeVisible({ timeout: 10_000 });
      });
    } finally {
      // ── Cleanup via direct API calls: cancel the appointment we created
      // (frees the slot), then delete the availability slot. ──────────────
      if (createdAppointmentId && patientToken.get()) {
        await apiCancelAppointment(patientPage.request, patientToken.get(), createdAppointmentId, "E2E cleanup");
      }
      if (slotId && doctorToken.get()) {
        await apiDeleteSlot(doctorPage.request, doctorToken.get(), slotId);
      }

      await doctorContext.close();
      await patientContext.close();
    }
  });
});

async function sendChatMessage(page: Page, text: string): Promise<void> {
  const input = page.getByPlaceholder("Describe your symptoms…");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await input.press("Enter");
}
