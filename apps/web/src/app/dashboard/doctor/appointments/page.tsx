"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

type Appointment = {
  id: string;
  scheduledAt: string;
  status: AppointmentStatus;
  type: "ONLINE" | "IN_PERSON";
  notes: string | null;
  durationMinutes: number;
  cancelledReason: string | null;
  videoRoomUrl: string | null;
  patient: {
    profile: { firstName: string; lastName: string; avatarUrl: string | null };
  };
  slot: { startTime: string; endTime: string } | null;
};

const STATUS_STYLES: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  SCHEDULED:   { label: "Scheduled",   color: "#64748B", bg: "#F1F5F9" },
  CONFIRMED:   { label: "Confirmed",   color: "#059669", bg: "#ECFDF5" },
  IN_PROGRESS: { label: "In Progress", color: "#2563EB", bg: "#EFF6FF" },
  COMPLETED:   { label: "Completed",   color: "#7C3AED", bg: "#F5F3FF" },
  CANCELLED:   { label: "Cancelled",   color: "#E11D48", bg: "#FFF1F2" },
  NO_SHOW:     { label: "No Show",     color: "#D97706", bg: "#FFFBEB" },
};

const FILTERS = ["All", "Scheduled", "Confirmed", "Completed", "Cancelled"] as const;
type Filter = typeof FILTERS[number];

const FILTER_STATUS: Record<Filter, AppointmentStatus | null> = {
  All: null,
  Scheduled: "SCHEDULED",
  Confirmed: "CONFIRMED",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
};

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("All");
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    apiGet<Appointment[]>("/appointments")
      .then(setAppointments)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = appointments.filter((a) => {
    const status = FILTER_STATUS[filter];
    return !status || a.status === status;
  });

  async function handleConfirm(id: string) {
    setActionLoading((prev) => new Set(prev).add(id));
    try {
      const updated = await apiPatch<Appointment>(`/appointments/${id}/confirm`);
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleCancel() {
    if (!cancelId) return;
    const id = cancelId;
    setActionLoading((prev) => new Set(prev).add(id));
    try {
      const updated = await apiPatch<Appointment>(`/appointments/${id}/cancel`, {
        reason: cancelReason || undefined,
      });
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setCancelId(null);
      setCancelReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function patientInitial(a: Appointment) {
    return a.patient.profile.firstName.charAt(0).toUpperCase();
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">Appointments</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <NotificationBell />
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {error && (
          <div className="mb-5 p-4 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] transition-all"
              style={{
                background: filter === f ? "#2563EB" : "#fff",
                color: filter === f ? "#fff" : "#64748B",
                border: filter === f ? "none" : "1px solid #E2E8F0",
              }}
            >
              {f}
              {f !== "All" && (
                <span className="ml-1.5 text-[11px] opacity-70">
                  ({appointments.filter((a) => a.status === FILTER_STATUS[f]).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
              <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[16px] text-[#0F172A] mb-1">No appointments</p>
            <p className="text-[14px] text-[#64748B]">No {filter !== "All" ? filter.toLowerCase() : ""} appointments found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((a) => {
              const s = STATUS_STYLES[a.status];
              const date = new Date(a.scheduledAt);
              const isPast = date < new Date();
              return (
                <div
                  key={a.id}
                  className="bg-white border border-[#E2E8F0] rounded-[16px] p-5 flex items-center gap-4"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[16px] text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#60A5FA,#3B82F6)" }}
                  >
                    {patientInitial(a)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-[15px] text-[#0F172A]">
                      {a.patient.profile.firstName} {a.patient.profile.lastName}
                    </p>
                    <p className="text-[13px] text-[#64748B] mt-0.5">
                      {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {" · "}
                      {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {a.durationMinutes} min
                      {" · "}
                      {a.type === "ONLINE" ? "Online" : "In-Person"}
                    </p>
                    {a.notes && (
                      <p className="text-[12px] text-[#94A3B8] mt-1 truncate">Note: {a.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="font-heading font-bold text-[11px] px-2.5 py-1 rounded-full"
                      style={{ color: s.color, background: s.bg }}
                    >
                      {s.label}
                    </span>
                    {a.status === "SCHEDULED" && !isPast && (
                      <button
                        onClick={() => handleConfirm(a.id)}
                        disabled={actionLoading.has(a.id)}
                        className="px-3 py-1.5 rounded-[8px] font-heading font-semibold text-[12px] text-white bg-[#059669] hover:bg-[#047857] transition-colors disabled:opacity-60"
                      >
                        {actionLoading.has(a.id) ? "…" : "Confirm"}
                      </button>
                    )}
                    {a.status === "CONFIRMED" && a.videoRoomUrl && (
                      <a
                        href={a.videoRoomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] font-heading font-semibold text-[12px] text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" />
                        </svg>
                        Join
                      </a>
                    )}
                    {(a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
                      <button
                        onClick={() => setCancelId(a.id)}
                        className="px-3 py-1.5 rounded-[8px] font-heading font-semibold text-[12px] text-[#E11D48] bg-[#FFF1F2] hover:bg-[#FFE4E6] transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cancel modal */}
      {cancelId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setCancelId(null); setCancelReason(""); } }}
        >
          <div className="bg-white rounded-[20px] w-full max-w-md p-6" style={{ animation: "fadeInUp 0.25s ease both" }}>
            <h2 className="font-heading font-bold text-[18px] text-[#0F172A] mb-1">Cancel Appointment</h2>
            <p className="text-[14px] text-[#64748B] mb-5">Provide an optional reason for the patient.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)…"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] resize-none mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setCancelId(null); setCancelReason(""); }}
                className="flex-1 py-3 rounded-[12px] font-heading font-semibold text-[14px] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleCancel}
                disabled={!!cancelId && actionLoading.has(cancelId)}
                className="flex-1 py-3 rounded-[12px] font-heading font-semibold text-[14px] text-white bg-[#E11D48] hover:bg-[#BE123C] transition-colors disabled:opacity-60"
              >
                {cancelId && actionLoading.has(cancelId) ? "Cancelling…" : "Cancel Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
