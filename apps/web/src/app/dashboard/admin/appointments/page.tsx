"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

type Profile = { firstName: string; lastName: string };
type PatientInAppt = { profile: Profile };
type DoctorInAppt  = { profile: Profile; specialty: { name: string } };
type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  type: string;
  patient: PatientInAppt;
  doctor: DoctorInAppt;
};

function statusStyle(status: string) {
  if (status === "CONFIRMED")   return { color: "#059669", bg: "#ECFDF5" };
  if (status === "IN_PROGRESS") return { color: "#D97706", bg: "#FFFBEB" };
  if (status === "COMPLETED")   return { color: "#7C3AED", bg: "#F3F0FF" };
  if (status === "CANCELLED")   return { color: "#DC2626", bg: "#FFF1F2" };
  if (status === "NO_SHOW")     return { color: "#64748B", bg: "#F1F5F9" };
  return { color: "#64748B", bg: "#F1F5F9" };
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type Filter = "all" | "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiGet<Appointment[]>("/admin/appointments?limit=200").then(setAppointments).catch(() => {});
  }, []);

  const filtered = appointments
    .filter((a) => filter === "all" || a.status === filter)
    .filter((a) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const p = `${a.patient.profile.firstName} ${a.patient.profile.lastName}`.toLowerCase();
      const d = `${a.doctor.profile.firstName} ${a.doctor.profile.lastName}`.toLowerCase();
      return p.includes(q) || d.includes(q) || a.doctor.specialty.name.toLowerCase().includes(q);
    });

  const counts: Record<Filter, number> = {
    all:       appointments.length,
    SCHEDULED: appointments.filter((a) => a.status === "SCHEDULED").length,
    CONFIRMED: appointments.filter((a) => a.status === "CONFIRMED").length,
    COMPLETED: appointments.filter((a) => a.status === "COMPLETED").length,
    CANCELLED: appointments.filter((a) => a.status === "CANCELLED").length,
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all",       label: `All (${counts.all})` },
    { key: "SCHEDULED", label: `Scheduled (${counts.SCHEDULED})` },
    { key: "CONFIRMED", label: `Confirmed (${counts.CONFIRMED})` },
    { key: "COMPLETED", label: `Completed (${counts.COMPLETED})` },
    { key: "CANCELLED", label: `Cancelled (${counts.CANCELLED})` },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <p className="font-heading font-bold text-[17px] text-[#0F172A]">All Appointments</p>
        <p className="text-[13px] text-[#64748B]">{appointments.length} total</p>
      </header>

      <main className="p-7 flex-1">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-[12px] flex-wrap">
            {filters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-3 py-2 rounded-[9px] font-heading font-semibold text-[13px] transition-all"
                style={{
                  background: filter === key ? "#fff" : "transparent",
                  color: filter === key ? "#0F172A" : "#64748B",
                  boxShadow: filter === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search patient or doctor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-4 py-2.5 rounded-[10px] text-[14px] bg-white border border-[#E2E8F0] outline-none focus:border-[#D97706]"
          />
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[20px] overflow-hidden">
          <div className="grid gap-4 px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]" style={{ gridTemplateColumns: "1.5fr 1.5fr 1.2fr 1fr 1fr" }}>
            {["Patient", "Doctor", "Date & Time", "Type", "Status"].map((h) => (
              <p key={h} className="font-heading font-semibold text-[11px] text-[#94A3B8] uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No appointments found</p>
            </div>
          ) : (
            filtered.map((appt) => {
              const { color, bg } = statusStyle(appt.status);
              return (
                <div
                  key={appt.id}
                  className="grid gap-4 px-5 py-4 border-b border-[#F8FAFC] last:border-0 items-center hover:bg-[#F8FAFC] transition-colors"
                  style={{ gridTemplateColumns: "1.5fr 1.5fr 1.2fr 1fr 1fr" }}
                >
                  <div>
                    <p className="font-heading font-semibold text-[14px] text-[#0F172A]">
                      {appt.patient.profile.firstName} {appt.patient.profile.lastName}
                    </p>
                    <p className="text-[11px] text-[#94A3B8]">Patient</p>
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-[14px] text-[#0F172A]">
                      Dr. {appt.doctor.profile.firstName} {appt.doctor.profile.lastName}
                    </p>
                    <p className="text-[11px] text-[#94A3B8]">{appt.doctor.specialty.name}</p>
                  </div>
                  <p className="text-[13px] text-[#64748B]">{formatDateTime(appt.scheduledAt)}</p>
                  <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full text-[#2563EB] bg-[#EFF6FF] w-fit">
                    {appt.type === "IN_PERSON" ? "In-Person" : "Online"}
                  </span>
                  <span
                    className="font-heading font-bold text-[10px] px-2.5 py-1 rounded-full w-fit"
                    style={{ color, background: bg }}
                  >
                    {appt.status.replace("_", " ")}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
