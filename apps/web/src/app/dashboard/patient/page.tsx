"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/client";
import { apiGet } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

// ─── Types ────────────────────────────────────────────────────────────────────

type DoctorProfile = { firstName: string; lastName: string };
type Specialty = { name: string };
type AppDoctor = { profile: DoctorProfile; specialty: Specialty };

type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  type: string;
  doctor: AppDoctor;
};

type Diagnostic = {
  id: string;
  urgency: string;
  status: string;
  possibleConditions: unknown;
  rawReport: string;
  suggestedSpecialty?: string;
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADIENTS = [
  "linear-gradient(135deg,#60A5FA,#3B82F6)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#F9A8D4,#EC4899)",
  "linear-gradient(135deg,#FCD34D,#F59E0B)",
  "linear-gradient(135deg,#A78BFA,#7C3AED)",
];

function statusStyle(status: string) {
  if (status === "CONFIRMED")   return { label: "CONFIRMED",   color: "#059669", bg: "#ECFDF5" };
  if (status === "IN_PROGRESS") return { label: "IN PROGRESS", color: "#D97706", bg: "#FFFBEB" };
  if (status === "COMPLETED")   return { label: "COMPLETED",   color: "#7C3AED", bg: "#F3F0FF" };
  if (status === "CANCELLED")   return { label: "CANCELLED",   color: "#DC2626", bg: "#FFF1F2" };
  return { label: "SCHEDULED", color: "#64748B", bg: "#F1F5F9" };
}

function urgencyStyle(urgency: string) {
  if (urgency === "EMERGENCY") return { label: "🚨 EMERGENCY", color: "#DC2626", bg: "#FFF1F2", border: "#FCA5A5" };
  if (urgency === "HIGH")      return { label: "🔴 HIGH",      color: "#EA580C", bg: "#FFF7ED", border: "#FDBA74" };
  if (urgency === "MEDIUM")    return { label: "⚡ MEDIUM",    color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };
  return                              { label: "🟢 LOW",       color: "#059669", bg: "#ECFDF5", border: "#6EE7B7" };
}

function diagStatusStyle(status: string) {
  if (status === "REVIEWED") return { label: "REVIEWED",        color: "#059669", bg: "#ECFDF5" };
  if (status === "ARCHIVED") return { label: "ARCHIVED",        color: "#64748B", bg: "#F1F5F9" };
  return                            { label: "PENDING REVIEW",  color: "#D97706", bg: "#FFFBEB" };
}

function formatScheduled(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === today.toDateString())    return `Today · ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}

function formatRelative(dateStr: string) {
  const diffH = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3_600_000);
  if (diffH < 1)  return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  if (diffH < 48) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function diagTitle(diag: { possibleConditions: unknown; rawReport: string; suggestedSpecialty?: string }): string {
  try {
    const c = diag.possibleConditions as Array<string | Record<string, string>>;
    if (Array.isArray(c) && c.length > 0) {
      const first = c[0];
      if (typeof first === "string") return first;
      return first.condition ?? first.name ?? first.title ?? Object.values(first)[0] ?? "";
    }
  } catch { /* noop */ }
  return diag.rawReport.split("\n").find((l) => l.trim()) ?? "Diagnostic report";
}

// ─── Quick Action Card ─────────────────────────────────────────────────────────

function QuickAction({
  href, gradient, iconBg, icon, title, subtitle, shadow, dark = true,
}: {
  href: string; gradient?: string; iconBg: string; icon: React.ReactNode;
  title: string; subtitle: string; shadow?: string; dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-[20px] p-[22px] flex flex-col gap-3.5 hover:-translate-y-1 transition-all duration-200"
      style={{ background: gradient ?? "#fff", border: gradient ? "none" : "1px solid #E2E8F0", boxShadow: shadow }}
    >
      <div className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: iconBg }}>
        {icon}
      </div>
      <div>
        <p className="font-heading font-bold text-[15px] mb-1" style={{ color: dark ? "#fff" : "#0F172A" }}>{title}</p>
        <p className="text-[12px]" style={{ color: dark ? "rgba(255,255,255,0.72)" : "#64748B" }}>{subtitle}</p>
      </div>
    </Link>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PatientDashboard() {
  const [userName, setUserName] = useState("");
  const [userInitial, setUserInitial] = useState("?");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user?.user_metadata?.full_name) {
        const name = data.user.user_metadata.full_name as string;
        setUserName(name);
        setUserInitial(name.charAt(0).toUpperCase());
      }
    })();
    apiGet<Appointment[]>("/appointments").then(setAppointments).catch(() => {});
    apiGet<Diagnostic[]>("/diagnostics").then(setDiagnostics).catch(() => {});
  }, []);

  const now = new Date();
  const upcoming = appointments
    .filter((a) => a.status !== "CANCELLED" && a.status !== "COMPLETED" && new Date(a.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 2);

  const recentDiags = diagnostics.slice(0, 2);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">Patient Dashboard</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[14px] text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
          >
            {userInitial}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {/* Greeting */}
        <div className="mb-7">
          <h1 className="font-heading font-bold text-[26px] text-[#0F172A] mb-1" style={{ letterSpacing: "-0.5px" }}>
            {greeting}, {userName ? userName.split(" ")[0] : "there"} 👋
          </h1>
          <p className="text-[15px] text-[#64748B]">Here&apos;s what&apos;s happening with your health today.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          <QuickAction
            href="/dashboard/patient/chat"
            gradient="linear-gradient(135deg,#2563EB,#1D4ED8)"
            iconBg="rgba(255,255,255,0.2)"
            shadow="0 4px 20px rgba(37,99,235,0.25)"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            }
            title="Start AI Chat"
            subtitle="Describe your symptoms"
          />
          <QuickAction
            href="/dashboard/patient/appointments"
            gradient="linear-gradient(135deg,#059669,#10B981)"
            iconBg="rgba(255,255,255,0.2)"
            shadow="0 4px 20px rgba(16,185,129,0.2)"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
            title="Book Appointment"
            subtitle="Find available doctors"
          />
          <QuickAction
            href="/dashboard/patient/diagnostics"
            iconBg="#FFFBEB"
            dark={false}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
              </svg>
            }
            title="View Reports"
            subtitle="Your diagnostic history"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Upcoming Appointments */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px]">
            <div className="flex items-center justify-between mb-[18px]">
              <h2 className="font-heading font-bold text-[16px] text-[#0F172A]">Upcoming Appointments</h2>
              <Link href="/dashboard/patient/appointments" className="font-heading font-semibold text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                View all
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No upcoming appointments</p>
                  <p className="text-[12px] text-[#CBD5E1] mt-1">Book one with a doctor</p>
                </div>
              ) : (
                upcoming.map((appt, i) => {
                  const name = `Dr. ${appt.doctor.profile.firstName} ${appt.doctor.profile.lastName}`;
                  const { label, color, bg } = statusStyle(appt.status);
                  return (
                    <div key={appt.id} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[14px] p-3.5 flex items-center gap-3.5">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[16px] text-white flex-shrink-0"
                        style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                      >
                        {appt.doctor.profile.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-[14px] text-[#0F172A] mb-0.5">{name}</p>
                        <p className="text-[12px] text-[#64748B]">{appt.doctor.specialty.name} · {formatScheduled(appt.scheduledAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
                          {label}
                        </span>
                        <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full text-[#2563EB] bg-[#EFF6FF]">
                          {appt.type === "IN_PERSON" ? "In-Person" : "Online"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              <Link
                href="/dashboard/patient/appointments"
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-[14px] text-white hover:shadow-lg hover:-translate-y-0.5 transition-all"
                style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 3px 12px rgba(37,99,235,0.25)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                Manage Appointments
              </Link>
            </div>
          </div>

          {/* Recent Diagnostics */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px]">
            <div className="flex items-center justify-between mb-[18px]">
              <h2 className="font-heading font-bold text-[16px] text-[#0F172A]">Recent Diagnostics</h2>
              <Link href="/dashboard/patient/diagnostics" className="font-heading font-semibold text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                View all
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {recentDiags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                    <rect x="4" y="3" width="16" height="18" rx="2" />
                    <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
                  </svg>
                  <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No diagnostics yet</p>
                  <p className="text-[12px] text-[#CBD5E1] mt-1">Start an AI chat to get your first report</p>
                </div>
              ) : (
                recentDiags.map((diag) => {
                  const u = urgencyStyle(diag.urgency);
                  const s = diagStatusStyle(diag.status);
                  const title = diagTitle(diag);
                  const desc = diag.suggestedSpecialty ? `Suggested: ${diag.suggestedSpecialty}` : "";
                  return (
                    <div key={diag.id} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[14px] p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span
                          className="font-heading font-bold text-[10px] px-2.5 py-0.5 rounded-full border"
                          style={{ color: u.color, background: u.bg, borderColor: u.border }}
                        >
                          {u.label}
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">{formatRelative(diag.createdAt)}</span>
                      </div>
                      <p className="font-heading font-semibold text-[14px] text-[#0F172A] mb-0.5 line-clamp-1">{title}</p>
                      {desc && <p className="text-[12px] text-[#64748B] mb-3">{desc}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                          {s.label}
                        </span>
                        <Link href="/dashboard/patient/diagnostics" className="font-heading font-semibold text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                          View Report →
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Health Profile Banner */}
        <div
          className="flex items-center justify-between px-6 py-5 rounded-[20px] border border-[#BFDBFE]"
          style={{ background: "linear-gradient(135deg,#F0F9FF,#EFF6FF)" }}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[14px] bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <div>
              <p className="font-heading font-bold text-[15px] text-[#0F172A] mb-0.5">Complete your health profile</p>
              <p className="text-[13px] text-[#64748B]">
                Add blood type, allergies, and emergency contact for better AI diagnostics.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/patient/profile"
            className="font-heading font-semibold text-[13px] text-white px-5 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors whitespace-nowrap flex-shrink-0"
            style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
          >
            Update Profile
          </Link>
        </div>
      </main>
    </>
  );
}
