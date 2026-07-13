import { expect, type Page } from "@playwright/test";

export type Role = "patient" | "doctor" | "admin";

const DASHBOARD_PATH: Record<Role, string> = {
  patient: "/dashboard/patient",
  doctor: "/dashboard/doctor",
  admin: "/dashboard/admin",
};

/**
 * Logs in through the real /login UI as the given role and waits for the
 * corresponding dashboard to load. Handles the optional doctor biometric
 * face-verify modal by skipping it (we don't have camera access in CI).
 *
 * Admin login uses the "Patient" toggle position per the login page's
 * design (the toggle is cosmetic — actual role comes from Supabase user
 * metadata), so we never select the "admin" role button.
 */
export async function loginAs(
  page: Page,
  role: Role,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");

  if (role === "doctor") {
    await page.getByRole("button", { name: "Doctor" }).click();
  }

  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /Sign In to MediCore|Signing in/ }).click();

  // Doctors with face biometrics enrolled see a verification modal — skip it.
  const skipButton = page.getByRole("button", { name: "Skip" });
  const dashboardUrl = new RegExp(DASHBOARD_PATH[role].replace(/\//g, "\\/"));
  await Promise.race([
    page.waitForURL(dashboardUrl, { timeout: 20_000 }).catch(() => {}),
    skipButton.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {}),
  ]);

  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
  }

  // A pending doctor gets redirected to /dashboard/doctor/pending instead —
  // still matches the doctor dashboard prefix, so this covers both cases.
  await page.waitForURL(dashboardUrl, { timeout: 20_000 });
}

/** Asserts the page is not showing a client-side error banner (best-effort smoke check). */
export async function expectNoErrorBanner(page: Page): Promise<void> {
  await expect(page.getByText(/Connection Error/i)).toHaveCount(0);
}
