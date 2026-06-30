"use client";

import { useState, useEffect, useMemo } from "react";
import { apiGet } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  type: string;
  patient: {
    id: string;
    profileId: string;
    profile: { firstName: string; lastName: string; phone: string | null };
  };
};

type PatientSummary = {
  profileId: string;
  patientId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  appointmentCount: number;
  lastVisit: string;
  lastStatus: string;
};

const GRADIENT_POOL = [
  "linear-gradient(135deg,#60A5FA,#3B82F6)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#F9A8D4,#EC4899)",
  "linear-gradient(135deg,#FCD34D,#F59E0B)",
  "linear-gradient(135deg,#A5B4FC,#7C3AED)",
  "linear-gradient(135deg,#6EE7B7,#059669)",
];

function gradientFor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return GRADIENT_POOL[n % GRADIENT_POOL.length];
}

export default function DoctorPatientsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const patients = useMemo<PatientSummary[]>(() => {
    const map = new Map<string, PatientSummary>();
    for (const a of appointments) {
      const pid = a.patient.profileId;
      if (!map.has(pid)) {
        map.set(pid, {
          profileId: pid,
          patientId: a.patient.id,
          firstName: a.patient.profile.firstName,
          lastName: a.patient.profile.lastName,
          phone: a.patient.profile.phone,
          appointmentCount: 0,
          lastVisit: a.scheduledAt,
          lastStatus: a.status,
        });
      }
      const p = map.get(pid)!;
      p.appointmentCount += 1;
      if (new Date(a.scheduledAt) > new Date(p.lastVisit)) {
        p.lastVisit = a.scheduledAt;
        p.lastStatus = a.status;
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
    );
  }, [appointments]);

  const filtered = patients.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.phone ?? "").includes(q)
    );
  });

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">My Patients</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <NotificationBell />
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {error && (
          <div className="mb-5 p-4 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
        )}

        {/* Stats + search */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-[16px] px-5 py-3 text-center">
              <p className="font-heading font-bold text-[22px] text-[#2563EB]">{patients.length}</p>
              <p className="text-[12px] text-[#64748B]">Total Patients</p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-[16px] px-5 py-3 text-center">
              <p className="font-heading font-bold text-[22px] text-[#059669]">
                {appointments.filter((a) => a.status === "CONFIRMED" || a.status === "SCHEDULED").length}
              </p>
              <p className="text-[12px] text-[#64748B]">Upcoming</p>
            </div>
          </div>
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[14px] text-[#0F172A] bg-white border border-[#E2E8F0] outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
        </div>

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
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[16px] text-[#0F172A] mb-1">No patients yet</p>
            <p className="text-[14px] text-[#64748B]">
              {search ? "No patients match your search." : "Patients who book with you will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((p) => {
              const name = `${p.firstName} ${p.lastName}`;
              const lastDate = new Date(p.lastVisit);
              return (
                <div
                  key={p.profileId}
                  className="bg-white border border-[#E2E8F0] rounded-[16px] p-5 flex items-start gap-4 hover:border-[#BFDBFE] hover:shadow-sm transition-all"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[18px] text-white flex-shrink-0"
                    style={{ background: gradientFor(name) }}
                  >
                    {p.firstName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-[15px] text-[#0F172A] mb-0.5">{name}</p>
                    {p.phone && (
                      <p className="text-[13px] text-[#64748B] mb-2">{p.phone}</p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[12px] text-[#94A3B8]">
                        {p.appointmentCount} appointment{p.appointmentCount !== 1 ? "s" : ""}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                      <span className="text-[12px] text-[#94A3B8]">
                        Last: {lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
