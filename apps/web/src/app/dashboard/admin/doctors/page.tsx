"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type DoctorStatus = "PENDING" | "ACTIVE" | "DEACTIVATED";
type Specialty = { name: string };
type DoctorRecord = { licenseNumber: string; specialty: Specialty; yearsExperience?: number | null; consultationFee?: string | null; status: DoctorStatus } | null;
type DoctorProfile = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  doctor: DoctorRecord;
};

type Tab = "all" | "pending" | "active" | "inactive";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_BADGES: Record<DoctorStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING: { label: "PENDING", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  ACTIVE: { label: "ACTIVE", color: "#059669", bg: "#ECFDF5", border: "#6EE7B7" },
  DEACTIVATED: { label: "DEACTIVATED", color: "#DC2626", bg: "#FFF1F2", border: "#FECDD3" },
};

function statusBadge(profile: DoctorProfile) {
  const status = profile.doctor?.status ?? (profile.isActive ? "ACTIVE" : "PENDING");
  return STATUS_BADGES[status];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<DoctorProfile[]>("/admin/users?role=DOCTOR");
      setDoctors(data);
    } catch {
      // Keep the existing list on a transient refresh failure so it doesn't
      // wipe out the visible effect of a mutation that just succeeded.
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    setActionId(id);
    try { await apiPost(`/admin/doctors/approve/${id}`); await load(); }
    catch { /* noop */ } finally { setActionId(null); }
  }

  async function toggle(id: string) {
    setActionId(id);
    try { await apiPatch(`/admin/users/${id}/toggle`); await load(); }
    catch { /* noop */ } finally { setActionId(null); }
  }

  function statusOf(d: DoctorProfile): DoctorStatus {
    return d.doctor?.status ?? (d.isActive ? "ACTIVE" : "PENDING");
  }

  const filtered = doctors
    .filter((d) => {
      const status = statusOf(d);
      if (tab === "pending")  return status === "PENDING";
      if (tab === "active")   return status === "ACTIVE";
      if (tab === "inactive") return status === "DEACTIVATED";
      return true;
    })
    .filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const name = `${d.firstName} ${d.lastName}`.toLowerCase();
      const spec = d.doctor?.specialty?.name?.toLowerCase() ?? "";
      const lic  = d.doctor?.licenseNumber?.toLowerCase() ?? "";
      return name.includes(q) || spec.includes(q) || lic.includes(q);
    });

  const counts = {
    all:      doctors.length,
    pending:  doctors.filter((d) => statusOf(d) === "PENDING").length,
    active:   doctors.filter((d) => statusOf(d) === "ACTIVE").length,
    inactive: doctors.filter((d) => statusOf(d) === "DEACTIVATED").length,
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "all",      label: `All (${counts.all})` },
    { key: "pending",  label: `Pending (${counts.pending})` },
    { key: "active",   label: `Active (${counts.active})` },
    { key: "inactive", label: `Inactive (${counts.inactive})` },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <p className="font-heading font-bold text-[17px] text-[#0F172A]">Doctor Management</p>
        <p className="text-[13px] text-[#64748B]">{doctors.length} doctors total</p>
      </header>

      <main className="p-7 flex-1">
        {/* Tabs + search */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-[12px]">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-3.5 py-2 rounded-[9px] font-heading font-semibold text-[13px] transition-all"
                style={{
                  background: tab === key ? "#fff" : "transparent",
                  color: tab === key ? "#0F172A" : "#64748B",
                  boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search by name, specialty, license…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-4 py-2.5 rounded-[10px] text-[14px] text-[#0F172A] bg-white border border-[#E2E8F0] outline-none focus:border-[#D97706]"
          />
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] overflow-hidden">
          {/* Header */}
          <div className="grid gap-4 px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]" style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1fr auto" }}>
            {["Doctor", "Specialty", "License", "Joined", "Status", "Actions"].map((h) => (
              <p key={h} className="font-heading font-semibold text-[11px] text-[#94A3B8] uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No doctors found</p>
            </div>
          ) : (
            filtered.map((doc) => {
              const { label, color, bg, border } = statusBadge(doc);
              const name = `${doc.firstName} ${doc.lastName}`;
              const status = statusOf(doc);
              const isPending = status === "PENDING";
              return (
                <div
                  key={doc.id}
                  className="grid gap-4 px-5 py-4 border-b border-[#F8FAFC] last:border-0 items-center hover:bg-[#FFFBEB]/30 transition-colors"
                  style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1fr auto" }}
                >
                  {/* Doctor */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0"
                      style={{ background: isPending ? "linear-gradient(135deg,#FCD34D,#F59E0B)" : "linear-gradient(135deg,#60A5FA,#3B82F6)" }}
                    >
                      {doc.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading font-semibold text-[14px] text-[#0F172A] truncate">Dr. {name}</p>
                    </div>
                  </div>

                  <p className="text-[13px] text-[#64748B]">{doc.doctor?.specialty?.name ?? "—"}</p>
                  <p className="text-[12px] text-[#94A3B8] font-mono truncate">{doc.doctor?.licenseNumber ?? "—"}</p>
                  <p className="text-[13px] text-[#64748B]">{formatDate(doc.createdAt)}</p>

                  {/* Status */}
                  <span
                    className="font-heading font-bold text-[10px] px-2.5 py-1 rounded-full border inline-block w-fit"
                    style={{ color, background: bg, borderColor: border }}
                  >
                    {label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isPending ? (
                      <button
                        onClick={() => approve(doc.id)}
                        disabled={actionId === doc.id}
                        className="px-3 py-1.5 rounded-[8px] font-heading font-semibold text-[12px] text-white bg-[#059669] hover:bg-[#047857] transition-colors disabled:opacity-60"
                      >
                        {actionId === doc.id ? "…" : "Approve"}
                      </button>
                    ) : status === "DEACTIVATED" ? (
                      <button
                        onClick={() => toggle(doc.id)}
                        disabled={actionId === doc.id}
                        className="px-3 py-1.5 rounded-[8px] font-heading font-semibold text-[12px] border transition-colors disabled:opacity-60"
                        style={{ color: "#059669", borderColor: "#6EE7B7", background: "#ECFDF5" }}
                      >
                        {actionId === doc.id ? "…" : "Reactivate"}
                      </button>
                    ) : (
                      <button
                        onClick={() => toggle(doc.id)}
                        disabled={actionId === doc.id}
                        className="px-3 py-1.5 rounded-[8px] font-heading font-semibold text-[12px] border transition-colors disabled:opacity-60"
                        style={{ color: "#DC2626", borderColor: "#FECDD3", background: "#FFF1F2" }}
                      >
                        {actionId === doc.id ? "…" : "Deactivate"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
