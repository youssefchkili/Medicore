"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isRecurring: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  const groups: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const key = new Date(slot.startTime).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(slot);
  }
  return groups;
}

export default function DoctorAvailabilityPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("09:30");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const todayIso = new Date().toISOString().split("T")[0];

  useEffect(() => {
    apiGet<Slot[]>("/availability/me")
      .then(setSlots)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await apiDelete(`/availability/${id}`);
      setSlots((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete slot");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formDate) { setFormError("Please select a date."); return; }
    const start = new Date(`${formDate}T${formStart}`);
    const end = new Date(`${formDate}T${formEnd}`);
    if (start <= new Date()) { setFormError("Start time must be in the future."); return; }
    if (end <= start) { setFormError("End time must be after start time."); return; }
    setFormLoading(true);
    try {
      const slot = await apiPost<Slot>("/availability", {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      setSlots((prev) => [...prev, slot].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ));
      setShowForm(false);
      setFormDate("");
      setFormStart("09:00");
      setFormEnd("09:30");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to add slot");
    } finally {
      setFormLoading(false);
    }
  }

  const groups = groupByDate(slots);
  const dateKeys = Object.keys(groups);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">Availability</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] font-heading font-semibold text-[13px] text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Slot
          </button>
          <NotificationBell />
        </div>
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {error && (
          <div className="mb-5 p-4 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
        )}

        {/* Stats */}
        <div className="flex gap-4 mb-7">
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] px-5 py-3 text-center">
            <p className="font-heading font-bold text-[22px] text-[#2563EB]">{slots.length}</p>
            <p className="text-[12px] text-[#64748B]">Total Slots</p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] px-5 py-3 text-center">
            <p className="font-heading font-bold text-[22px] text-[#059669]">{slots.filter((s) => !s.isBooked).length}</p>
            <p className="text-[12px] text-[#64748B]">Available</p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] px-5 py-3 text-center">
            <p className="font-heading font-bold text-[22px] text-[#D97706]">{slots.filter((s) => s.isBooked).length}</p>
            <p className="text-[12px] text-[#64748B]">Booked</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
              <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[16px] text-[#0F172A] mb-1">No availability slots</p>
            <p className="text-[14px] text-[#64748B] mb-5">Add your first slot so patients can book consultations.</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-[12px] font-heading font-semibold text-[14px] text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
            >
              Add First Slot
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {dateKeys.map((dateKey) => (
              <div key={dateKey}>
                <p className="font-heading font-bold text-[13px] text-[#64748B] uppercase tracking-wide mb-3">
                  {formatDate(groups[dateKey][0].startTime)}
                </p>
                <div className="flex flex-col gap-2">
                  {groups[dateKey].map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-white border border-[#E2E8F0] rounded-[14px] px-5 py-3.5 flex items-center justify-between"
                      style={slot.isBooked ? { opacity: 0.7 } : undefined}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: slot.isBooked ? "#D97706" : "#059669" }} />
                        <div>
                          <p className="font-heading font-semibold text-[14px] text-[#0F172A]">
                            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                          </p>
                          <p className="text-[12px] text-[#94A3B8]">
                            {Math.round((new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 60000)} min
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-heading font-bold text-[11px] px-2.5 py-1 rounded-full"
                          style={{
                            color: slot.isBooked ? "#D97706" : "#059669",
                            background: slot.isBooked ? "#FFFBEB" : "#ECFDF5",
                          }}
                        >
                          {slot.isBooked ? "Booked" : "Available"}
                        </span>
                        {!slot.isBooked && (
                          <button
                            onClick={() => handleDelete(slot.id)}
                            disabled={deletingIds.has(slot.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FFF1F2] transition-colors disabled:opacity-50"
                            title="Delete slot"
                          >
                            {deletingIds.has(slot.id) ? (
                              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#E11D48" strokeWidth="4" />
                                <path className="opacity-75" fill="#E11D48" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add slot modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="bg-white rounded-[20px] w-full max-w-md p-6" style={{ animation: "fadeInUp 0.25s ease both" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-[18px] text-[#0F172A]">Add Availability Slot</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSlot} className="flex flex-col gap-4">
              <div>
                <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">Date</label>
                <input
                  type="date"
                  value={formDate}
                  min={todayIso}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">Start Time</label>
                  <input
                    type="time"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">End Time</label>
                  <input
                    type="time"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>
              {formError && (
                <p className="text-[13px] text-[#E11D48]">{formError}</p>
              )}
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-[12px] font-heading font-semibold text-[14px] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 rounded-[12px] font-heading font-semibold text-[14px] text-white transition-colors disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
                >
                  {formLoading ? "Adding…" : "Add Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
