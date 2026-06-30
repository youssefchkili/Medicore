"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type SlotDoctor = {
  id: string;
  profile: { firstName: string; lastName: string };
  specialty: { name: string };
  bio: string | null;
  consultationFee: string | null;
  rating: number | null;
};

type AvailabilitySlot = {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
};

type Appointment = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  type: "ONLINE" | "IN_PERSON";
  status: "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  notes: string | null;
  videoRoomUrl: string | null;
  doctor: { profile: { firstName: string; lastName: string }; specialty: { name: string } };
  slot: { startTime: string; endTime: string };
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: "Scheduled", color: "#64748B", bg: "#F1F5F9" },
  CONFIRMED: { label: "Confirmed", color: "#059669", bg: "#ECFDF5" },
  IN_PROGRESS: { label: "In Progress", color: "#2563EB", bg: "#EFF6FF" },
  COMPLETED: { label: "Completed", color: "#7C3AED", bg: "#F5F3FF" },
  CANCELLED: { label: "Cancelled", color: "#DC2626", bg: "#FEF2F2" },
  NO_SHOW: { label: "No Show", color: "#94A3B8", bg: "#F8FAFC" },
};

const GRADIENTS = [
  "linear-gradient(135deg,#60A5FA,#3B82F6)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#A78BFA,#7C3AED)",
  "linear-gradient(135deg,#FB923C,#F97316)",
  "linear-gradient(135deg,#F472B6,#EC4899)",
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Booking Modal ─────────────────────────────────────────────────────────────

function BookingModal({ onClose, onBooked }: { onClose: () => void; onBooked: () => void }) {
  const [step, setStep] = useState<"doctors" | "slots" | "confirm">("doctors");
  const [doctors, setDoctors] = useState<SlotDoctor[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<SlotDoctor | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"ONLINE" | "IN_PERSON">("ONLINE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchSpecialty, setSearchSpecialty] = useState("");

  useEffect(() => {
    apiGet<SlotDoctor[]>("/users/doctors?available=true").then(setDoctors).catch(() => {});
  }, []);

  async function loadSlots(doctorId: string) {
    setLoading(true);
    try {
      const data = await apiGet<AvailabilitySlot[]>(`/availability/${doctorId}`);
      setSlots(data.filter((s) => !s.isBooked));
    } catch {
      setError("Failed to load slots.");
    } finally {
      setLoading(false);
    }
  }

  function selectDoctor(doc: SlotDoctor) {
    setSelectedDoctor(doc);
    loadSlots(doc.id);
    setStep("slots");
  }

  async function confirmBooking() {
    if (!selectedDoctor || !selectedSlot) return;
    setLoading(true);
    setError("");
    try {
      await apiPost("/appointments", {
        doctorId: selectedDoctor.id,
        slotId: selectedSlot.id,
        type,
        notes: notes.trim() || undefined,
      });
      onBooked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed.");
    } finally {
      setLoading(false);
    }
  }

  const filteredDoctors = searchSpecialty
    ? doctors.filter((d) => d.specialty.name.toLowerCase().includes(searchSpecialty.toLowerCase()) ||
        `${d.profile.firstName} ${d.profile.lastName}`.toLowerCase().includes(searchSpecialty.toLowerCase()))
    : doctors;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div
        className="bg-white rounded-[24px] w-full max-w-xl max-h-[85vh] flex flex-col"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-[18px] text-[#0F172A]">Book Appointment</h2>
            <p className="text-[12px] text-[#94A3B8] mt-0.5">
              {step === "doctors" && "Select a doctor"}
              {step === "slots" && `Pick a time — Dr. ${selectedDoctor?.profile.firstName} ${selectedDoctor?.profile.lastName}`}
              {step === "confirm" && "Confirm your booking"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <div className="flex px-6 pt-4 gap-2">
          {["doctors", "slots", "confirm"].map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
              step === s ? "bg-[#2563EB]" :
              (step === "slots" && i === 0) || (step === "confirm") ? "bg-[#BFDBFE]" : "bg-[#E2E8F0]"
            }`} />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-[10px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[13px]">{error}</div>
          )}

          {/* Step 1: Doctors */}
          {step === "doctors" && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Search by name or specialty…"
                value={searchSpecialty}
                onChange={(e) => setSearchSpecialty(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] focus:bg-white transition-all"
              />
              {filteredDoctors.length === 0 ? (
                <p className="text-center text-[14px] text-[#94A3B8] py-6">No available doctors found</p>
              ) : filteredDoctors.map((doc, i) => (
                <button
                  key={doc.id}
                  onClick={() => selectDoctor(doc)}
                  className="w-full flex items-center gap-3.5 p-4 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] transition-all text-left"
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[16px] text-white flex-shrink-0"
                    style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                  >
                    {doc.profile.firstName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-[14px] text-[#0F172A]">
                      Dr. {doc.profile.firstName} {doc.profile.lastName}
                    </p>
                    <p className="text-[12px] text-[#64748B]">{doc.specialty.name}</p>
                  </div>
                  {doc.consultationFee && (
                    <div className="text-right flex-shrink-0">
                      <p className="font-heading font-semibold text-[14px] text-[#0F172A]">{doc.consultationFee} TND</p>
                      {doc.rating && <p className="text-[11px] text-[#94A3B8]">★ {doc.rating.toFixed(1)}</p>}
                    </div>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Slots */}
          {step === "slots" && (
            <div className="flex flex-col gap-3">
              <button onClick={() => setStep("doctors")} className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline mb-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back to doctors
              </button>
              {loading ? (
                <div className="flex justify-center py-8">
                  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
                    <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : slots.length === 0 ? (
                <p className="text-center text-[14px] text-[#94A3B8] py-8">No available slots for this doctor</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => { setSelectedSlot(slot); setStep("confirm"); }}
                      className="p-3 rounded-[12px] border text-left hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-all"
                      style={{ border: "1px solid #E2E8F0" }}
                    >
                      <p className="font-heading font-semibold text-[13px] text-[#0F172A]">{formatDate(slot.startTime)}</p>
                      <p className="text-[12px] text-[#64748B]">{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && selectedDoctor && selectedSlot && (
            <div className="flex flex-col gap-4">
              <button onClick={() => setStep("slots")} className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back to slots
              </button>

              {/* Summary */}
              <div className="p-4 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-[15px]"
                    style={{ background: GRADIENTS[0] }}>
                    {selectedDoctor.profile.firstName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-[14px] text-[#0F172A]">
                      Dr. {selectedDoctor.profile.firstName} {selectedDoctor.profile.lastName}
                    </p>
                    <p className="text-[12px] text-[#64748B]">{selectedDoctor.specialty.name}</p>
                  </div>
                </div>
                <div className="h-px bg-[#F1F5F9]" />
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#64748B]">Date & Time</span>
                  <span className="font-heading font-semibold text-[#0F172A]">
                    {formatDate(selectedSlot.startTime)} at {formatTime(selectedSlot.startTime)}
                  </span>
                </div>
                {selectedDoctor.consultationFee && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#64748B]">Consultation Fee</span>
                    <span className="font-heading font-semibold text-[#0F172A]">{selectedDoctor.consultationFee} TND</span>
                  </div>
                )}
              </div>

              {/* Type toggle */}
              <div>
                <p className="font-heading font-semibold text-[12px] text-[#64748B] mb-2">Appointment Type</p>
                <div className="flex gap-2">
                  {(["ONLINE", "IN_PERSON"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className="flex-1 py-2.5 rounded-[10px] font-heading font-semibold text-[13px] transition-all"
                      style={{
                        background: type === t ? "#2563EB" : "#F8FAFC",
                        color: type === t ? "#fff" : "#64748B",
                        border: type === t ? "none" : "1px solid #E2E8F0",
                      }}
                    >
                      {t === "ONLINE" ? "Online" : "In Person"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="font-heading font-semibold text-[12px] text-[#64748B] mb-2">Notes (optional)</p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe your reason for the visit…"
                  className="w-full px-4 py-3 rounded-xl text-[14px] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] focus:bg-white transition-all resize-none"
                />
              </div>

              <button
                onClick={confirmBooking}
                disabled={loading}
                className="w-full py-3.5 rounded-[14px] font-heading font-semibold text-[15px] text-white transition-all disabled:opacity-60 hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 3px 12px rgba(37,99,235,0.25)" }}
              >
                {loading ? "Booking…" : "Confirm Booking"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const loadAppointments = useCallback(() => {
    setLoading(true);
    apiGet<Appointment[]>("/appointments")
      .then(setAppointments)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const now = new Date();
  const upcoming = appointments.filter(
    (a) => new Date(a.scheduledAt) >= now && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(a.status)
  );
  const past = appointments.filter(
    (a) => new Date(a.scheduledAt) < now || ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(a.status)
  );
  const displayed = tab === "upcoming" ? upcoming : past;

  async function cancelAppointment(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    try {
      await apiPatch(`/appointments/${id}/cancel`, { reason: "Cancelled by patient" });
      loadAppointments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel.");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">My Appointments</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBooking(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#2563EB] text-white font-heading font-semibold text-[13px] hover:bg-[#1D4ED8] transition-colors"
            style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Book Appointment
          </button>
          <NotificationBell />
        </div>
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-4">
            <p className="text-[12px] text-[#94A3B8] mb-1">Upcoming</p>
            <p className="font-heading font-bold text-[28px] text-[#2563EB]">{upcoming.length}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-4">
            <p className="text-[12px] text-[#94A3B8] mb-1">Confirmed</p>
            <p className="font-heading font-bold text-[28px] text-[#059669]">
              {upcoming.filter((a) => a.status === "CONFIRMED").length}
            </p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-4">
            <p className="text-[12px] text-[#94A3B8] mb-1">Completed</p>
            <p className="font-heading font-bold text-[28px] text-[#7C3AED]">
              {appointments.filter((a) => a.status === "COMPLETED").length}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] transition-colors capitalize"
              style={{
                background: tab === t ? "#2563EB" : "#F8FAFC",
                color: tab === t ? "#fff" : "#64748B",
                border: tab === t ? "none" : "1px solid #E2E8F0",
              }}
            >
              {t} ({t === "upcoming" ? upcoming.length : past.length})
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
              <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="p-5 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="font-heading font-semibold text-[16px] text-[#0F172A] mb-1">
              No {tab} appointments
            </p>
            <p className="text-[14px] text-[#64748B] mb-5">
              {tab === "upcoming" ? "Book an appointment with a doctor" : "Your past appointments will appear here"}
            </p>
            {tab === "upcoming" && (
              <button
                onClick={() => setShowBooking(true)}
                className="px-5 py-2.5 rounded-[12px] bg-[#2563EB] text-white font-heading font-semibold text-[14px] hover:bg-[#1D4ED8] transition-colors"
              >
                Book Appointment
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map((appt, i) => {
              const statusMeta = STATUS_META[appt.status];
              const docName = `Dr. ${appt.doctor.profile.firstName} ${appt.doctor.profile.lastName}`;
              const initial = appt.doctor.profile.firstName.charAt(0);

              return (
                <div key={appt.id} className="bg-white border border-[#E2E8F0] rounded-[16px] p-4 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[18px] text-white flex-shrink-0"
                    style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                  >
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-heading font-semibold text-[15px] text-[#0F172A]">{docName}</p>
                      <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full" style={{ color: statusMeta.color, background: statusMeta.bg }}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#64748B]">
                      {appt.doctor.specialty.name} · {formatDate(appt.scheduledAt)} at {formatTime(appt.scheduledAt)}
                    </p>
                    {appt.notes && <p className="text-[12px] text-[#94A3B8] mt-0.5 truncate">{appt.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-heading font-bold text-[11px] px-2 py-1 rounded-full text-[#2563EB] bg-[#EFF6FF]">
                      {appt.type === "ONLINE" ? "Online" : "In Person"}
                    </span>
                    {appt.status === "CONFIRMED" && appt.videoRoomUrl && (
                      <a
                        href={appt.videoRoomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#059669] text-white font-heading font-semibold text-[12px] hover:bg-[#047857] transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" />
                        </svg>
                        Join
                      </a>
                    )}
                    {["SCHEDULED", "CONFIRMED"].includes(appt.status) && (
                      <button
                        onClick={() => cancelAppointment(appt.id)}
                        className="px-3 py-1.5 rounded-[8px] bg-[#FEF2F2] text-[#DC2626] font-heading font-semibold text-[12px] hover:bg-[#FEE2E2] transition-colors"
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

      {showBooking && <BookingModal onClose={() => setShowBooking(false)} onBooked={loadAppointments} />}
    </>
  );
}
