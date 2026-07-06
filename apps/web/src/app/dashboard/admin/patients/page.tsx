"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type PatientRecord = { bloodType?: string | null; allergies?: string[]; chronicConditions?: string[] } | null;
type PatientProfile = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  patient: PatientRecord;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiGet<PatientProfile[]>("/admin/users?role=PATIENT").catch(() => []);
    setPatients(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: string) {
    setActionId(id);
    try { await apiPatch(`/admin/users/${id}/toggle`); await load(); }
    catch { /* noop */ } finally { setActionId(null); }
  }

  const filtered = patients.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
  });

  const active   = patients.filter((p) =>  p.isActive).length;
  const inactive = patients.filter((p) => !p.isActive).length;

  const GRADIENTS = [
    "linear-gradient(135deg,#60A5FA,#3B82F6)",
    "linear-gradient(135deg,#34D399,#10B981)",
    "linear-gradient(135deg,#F9A8D4,#EC4899)",
    "linear-gradient(135deg,#FCD34D,#F59E0B)",
    "linear-gradient(135deg,#A78BFA,#7C3AED)",
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <p className="font-heading font-bold text-[17px] text-[#0F172A]">Patient Management</p>
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-[#64748B]">{active} active · {inactive} inactive</span>
        </div>
      </header>

      <main className="p-7 flex-1">
        <div className="flex items-center justify-between mb-5">
          <p className="font-heading font-semibold text-[15px] text-[#0F172A]">{patients.length} registered patients</p>
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-4 py-2.5 rounded-[10px] text-[14px] text-[#0F172A] bg-white border border-[#E2E8F0] outline-none focus:border-[#D97706]"
          />
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[20px] overflow-hidden">
          {/* Header */}
          <div className="grid gap-4 px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
            {["Patient", "Blood Type", "Conditions", "Joined", "Status / Action"].map((h) => (
              <p key={h} className="font-heading font-semibold text-[11px] text-[#94A3B8] uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
              </svg>
              <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No patients found</p>
            </div>
          ) : (
            filtered.map((p, i) => (
              <div
                key={p.id}
                className="grid gap-4 px-5 py-4 border-b border-[#F8FAFC] last:border-0 items-center hover:bg-[#F8FAFC] transition-colors"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}
              >
                {/* Patient */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0"
                    style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                  >
                    {p.firstName.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-heading font-semibold text-[14px] text-[#0F172A] truncate">{p.firstName} {p.lastName}</p>
                </div>

                <p className="text-[13px] text-[#64748B]">{p.patient?.bloodType?.replace("_POS", "+").replace("_NEG", "-") ?? "—"}</p>

                <p className="text-[13px] text-[#64748B]">
                  {p.patient?.chronicConditions?.length ? p.patient.chronicConditions.slice(0, 2).join(", ") : "—"}
                </p>

                <p className="text-[13px] text-[#64748B]">{formatDate(p.createdAt)}</p>

                {/* Status + action */}
                <div className="flex items-center gap-2">
                  <span
                    className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      color: p.isActive ? "#059669" : "#DC2626",
                      background: p.isActive ? "#ECFDF5" : "#FFF1F2",
                    }}
                  >
                    {p.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                  <button
                    onClick={() => toggle(p.id)}
                    disabled={actionId === p.id}
                    className="px-2.5 py-1 rounded-[7px] font-heading font-semibold text-[11px] border transition-colors disabled:opacity-60"
                    style={
                      p.isActive
                        ? { color: "#DC2626", borderColor: "#FECDD3", background: "#FFF1F2" }
                        : { color: "#059669", borderColor: "#6EE7B7", background: "#ECFDF5" }
                    }
                  >
                    {actionId === p.id ? "…" : p.isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
