/**
 * Mirrors the date/time formatting used across the dashboard pages
 * (e.g. apps/web/src/app/dashboard/patient/appointments/page.tsx) so tests
 * can assert against the exact strings rendered in the UI.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Same as buildFutureSlot, but derives the day/hour/minute from the current
 * timestamp so repeated test runs get a near-certainly-unique slot,
 * spread across a wide day/time window (~20 days, full 24h clock). This
 * avoids collisions both between slots requested in the same run (pass a
 * distinct `offsetMinutes`, e.g. 0, 90, 180, ...) and with leftover slots
 * from previous runs — notably ones the app's own DELETE /availability/:id
 * endpoint fails to clean up once a slot has any appointment history (see
 * known-issues note in e2e/README — a Prisma P2003 FK constraint error).
 */
export function buildUniqueFutureSlot(daysAheadBase: number, offsetMinutes = 0, durationMinutes = 30) {
  const totalOffset = Math.floor(Date.now() / 60_000) + offsetMinutes; // whole minutes since epoch + caller offset
  const dayJitter = totalOffset % 20; // spread across ~20 days
  const minuteOfDay = (totalOffset * 7) % (24 * 60); // pseudo-spread across the full 24h clock
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return buildFutureSlot(daysAheadBase + dayJitter, hour, minute, durationMinutes);
}

/** Returns { dateIso, startTime, endTime, startDate, endDate } for a slot `daysAhead` days from now. */
export function buildFutureSlot(daysAhead: number, hour: number, minute: number, durationMinutes = 30) {
  const start = new Date();
  start.setDate(start.getDate() + daysAhead);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const dateIso = start.toISOString().split("T")[0];
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    dateIso,
    startTimeInput: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTimeInput: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    startDate: start,
    endDate: end,
  };
}
