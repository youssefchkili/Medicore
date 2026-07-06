"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = {
  patients: number;
  doctors: number;
  pendingDoctors: number;
  appointments: number;
  diagnostics: number;
};

type DoctorProfile = { firstName: string; lastName: string; createdAt: string };
type Specialty = { name: string };
type DoctorRecord = { licenseNumber: string; specialty: Specialty } | null;
type PendingDoctor = { id: string; profile?: DoctorProfile; doctor?: DoctorRecord } & DoctorProfile;

type AuditActor = { firstName: string; lastName: string; role: string };
type AuditLog = {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
  actor: AuditActor;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string) {
  const diffH = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3_600_000);
  if (diffH < 1)  return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  if (diffH < 48) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function actionLabel(action: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    DOCTOR_APPROVED:   { label: "Doctor Approved",   color: "#059669", bg: "#ECFDF5" },
    USER_ACTIVATED:    { label: "User Activated",     color: "#059669", bg: "#ECFDF5" },
    USER_DEACTIVATED:  { label: "User Deactivated",   color: "#DC2626", bg: "#FFF1F2" },
  };
  return map[action] ?? { label: action.replace(/_/g, " "), color: "#64748B", bg: "#F1F5F9" };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, iconBg, accent, icon,
}: {
  label: string; value: number; sub: string;
  iconBg: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        {icon}
      </div>
      <div>
        <p className="text-[13px] text-[#64748B] mb-1">{label}</p>
        <p className="font-heading font-bold text-[26px] leading-none" style={{ color: accent }}>{value}</p>
        <p className="text-[12px] text-[#94A3B8] mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingDoctor[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const load = useCallback(async () => {
    const [s, p, a] = await Promise.allSettled([
      apiGet<Stats>("/admin/stats"),
      apiGet<PendingDoctor[]>("/admin/doctors/pending"),
      apiGet<AuditLog[]>("/admin/audit-logs?limit=10"),
    ]);
    if (s.status === "fulfilled") setStats(s.value);
    if (p.status === "fulfilled") setPending(p.value);
    if (a.status === "fulfilled") setAuditLogs(a.value);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(profileId: string) {
    setApprovingId(profileId);
    try {
      await apiPost(`/admin/doctors/approve/${profileId}`);
      await load();
    } catch { /* noop */ } finally {
      setApprovingId(null);
    }
  }

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">Admin Overview</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {/* Pending doctors alert */}
        {pending.length > 0 && (
          <div className="mb-6 flex items-center justify-between px-5 py-4 rounded-[16px] border border-[#FDE68A]" style={{ background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#FEF3C7] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="font-heading font-bold text-[14px] text-[#92400E]">
                  {pending.length} doctor{pending.length > 1 ? "s" : ""} waiting for approval
                </p>
                <p className="text-[12px] text-[#B45309]">Review and approve pending registrations below</p>
              </div>
            </div>
            <Link href="/dashboard/admin/doctors" className="font-heading font-semibold text-[13px] text-[#D97706] hover:text-[#B45309] transition-colors">
              View all →
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-7">
          <StatCard
            label="Active Doctors" value={stats?.doctors ?? 0} sub="approved"
            iconBg="#EFF6FF" accent="#2563EB"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>}
          />
          <StatCard
            label="Pending Approvals" value={stats?.pendingDoctors ?? 0} sub="need review"
            iconBg="#FFFBEB" accent="#D97706"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
          />
          <StatCard
            label="Patients" value={stats?.patients ?? 0} sub="registered"
            iconBg="#ECFDF5" accent="#059669"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>}
          />
          <StatCard
            label="Appointments" value={stats?.appointments ?? 0} sub="all time"
            iconBg="#F3F0FF" accent="#7C3AED"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
          />
          <StatCard
            label="AI Diagnostics" value={stats?.diagnostics ?? 0} sub="generated"
            iconBg="#FFF1F2" accent="#E11D48"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>}
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Pending Doctor Approvals */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-[16px] text-[#0F172A]">Pending Approvals</h2>
                {pending.length > 0 && (
                  <span className="font-heading font-bold text-[10px] px-1.5 py-0.5 rounded-full text-white bg-[#EF4444]">
                    {pending.length}
                  </span>
                )}
              </div>
              <Link href="/dashboard/admin/doctors" className="font-heading font-semibold text-[13px] text-[#D97706] hover:text-[#B45309] transition-colors">
                View all
              </Link>
            </div>

            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">All caught up!</p>
                <p className="text-[12px] text-[#CBD5E1] mt-1">No pending doctor approvals</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pending.slice(0, 4).map((doc) => {
                  const name = `Dr. ${doc.firstName} ${doc.lastName}`;
                  return (
                    <div key={doc.id} className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center font-bold text-[15px] text-[#D97706] flex-shrink-0">
                        {doc.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-[14px] text-[#0F172A]">{name}</p>
                        <p className="text-[12px] text-[#64748B]">
                          {doc.doctor?.specialty?.name ?? "No specialty yet"} · {formatRelative(doc.createdAt)}
                        </p>
                        {doc.doctor?.licenseNumber && (
                          <p className="text-[11px] text-[#94A3B8] font-mono">{doc.doctor.licenseNumber}</p>
                        )}
                      </div>
                      <button
                        onClick={() => approve(doc.id)}
                        disabled={approvingId === doc.id}
                        className="flex-shrink-0 px-3 py-1.5 rounded-[8px] font-heading font-semibold text-[12px] text-white bg-[#059669] hover:bg-[#047857] transition-colors disabled:opacity-60"
                      >
                        {approvingId === doc.id ? "…" : "Approve"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Audit Log */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-[16px] text-[#0F172A]">Recent Activity</h2>
              <Link href="/dashboard/admin/audit" className="font-heading font-semibold text-[13px] text-[#D97706] hover:text-[#B45309] transition-colors">
                View all
              </Link>
            </div>

            {auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No activity yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {auditLogs.map((log) => {
                  const { label, color, bg } = actionLabel(log.action);
                  return (
                    <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-[#F1F5F9] last:border-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] text-[#D97706] bg-[#FFFBEB] flex-shrink-0 mt-0.5">
                        {log.actor.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-heading font-semibold text-[13px] text-[#0F172A] truncate">
                            {log.actor.firstName} {log.actor.lastName}
                          </p>
                          <span className="font-heading font-bold text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color, background: bg }}>
                            {label}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8]">{formatRelative(log.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          {[
            { href: "/dashboard/admin/doctors", label: "Manage Doctors", sub: "Approve, activate, deactivate", color: "#2563EB", bg: "#EFF6FF" },
            { href: "/dashboard/admin/patients", label: "Manage Patients", sub: "View and manage patient accounts", color: "#059669", bg: "#ECFDF5" },
            { href: "/dashboard/admin/appointments", label: "All Appointments", sub: "Browse the full appointment log", color: "#7C3AED", bg: "#F3F0FF" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white border border-[#E2E8F0] rounded-[16px] p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="1.8">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <p className="font-heading font-semibold text-[14px] text-[#0F172A]">{item.label}</p>
                <p className="text-[12px] text-[#64748B]">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
