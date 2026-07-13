import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/auth-helpers";
import { PATIENT } from "./fixtures/accounts";

/**
 * Regression test for a fixed bug on the "Browse Doctors" page
 * (apps/web/src/app/dashboard/patient/doctors/page.tsx): the frontend used
 * to send the specialty's display name instead of its slug to
 * GET /users/doctors?specialty=..., so filtering silently returned an
 * unfiltered (or empty) list. Asserts both the outgoing request param and
 * the resulting visible list are correctly scoped to the chosen specialty.
 */
test.describe("Regression: Browse Doctors specialty filter", () => {
  test("clicking the Neurology specialty pill filters the doctor list by slug", async ({ page }) => {
    await loginAs(page, "patient", PATIENT.email, PATIENT.password);
    await page.goto("/dashboard/patient/doctors");

    await expect(page.getByText(/doctors? found/)).toBeVisible();

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes("/users/doctors") && req.url().includes("specialty=")
    );
    await page.getByRole("button", { name: "Neurology", exact: true }).click();
    const request = await requestPromise;

    const url = new URL(request.url());
    const specialtyParam = url.searchParams.get("specialty");
    // The regression: the app used to send "Neurology" (the display name)
    // instead of the specialty slug (e.g. "neurology").
    expect(specialtyParam).toBe("neurology");
    expect(specialtyParam).not.toBe("Neurology");

    await expect(page.getByText(/doctors? found/)).toBeVisible();
    const doctorCards = page.locator(".grid.grid-cols-2 > div");
    await expect(doctorCards.first()).toBeVisible();

    const count = await doctorCards.count();
    for (let i = 0; i < count; i++) {
      await expect(doctorCards.nth(i)).toContainText("Neurology");
    }

    // Sanity: at least the known Neurology doctor (Ridha Chkili) is present.
    await expect(page.getByText("Dr. Ridha Chkili")).toBeVisible();
  });
});
