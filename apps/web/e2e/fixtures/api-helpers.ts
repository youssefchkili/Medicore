import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Direct-API helpers used to reliably ARRANGE (and clean up) prerequisite
 * data — e.g. availability slots — for tests whose actual subject-under-test
 * is a UI interaction (booking, confirming, cancelling). Using the API for
 * setup/teardown avoids flakiness/duplication from looped UI form
 * submissions and keeps tests fast and idempotent on the shared Supabase
 * project.
 */
const API_BASE = "http://localhost:3001";

export interface AuthTokenCapture {
  get: () => string;
}

/** Starts capturing the bearer token this page sends to the NestJS API (call before navigating). */
export function captureAuthToken(page: Page): AuthTokenCapture {
  let token = "";
  page.on("request", (req) => {
    if (!req.url().startsWith(API_BASE)) return;
    const auth = req.headers()["authorization"];
    if (auth) token = auth;
  });
  return { get: () => token };
}

export async function apiCreateSlot(
  request: APIRequestContext,
  token: string,
  startIso: string,
  endIso: string
): Promise<{ id: string }> {
  const res = await request.post(`${API_BASE}/availability`, {
    headers: { Authorization: token },
    data: { startTime: startIso, endTime: endIso },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create availability slot: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

export async function apiDeleteSlot(request: APIRequestContext, token: string, id: string): Promise<void> {
  await request.delete(`${API_BASE}/availability/${id}`, { headers: { Authorization: token } }).catch(() => {});
}

export async function apiCancelAppointment(
  request: APIRequestContext,
  token: string,
  id: string,
  reason?: string
): Promise<void> {
  await request
    .patch(`${API_BASE}/appointments/${id}/cancel`, {
      headers: { Authorization: token },
      data: { reason },
    })
    .catch(() => {});
}
