"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/client";
import { apiGet } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientProfile = { firstName: string; lastName: string };
type AppPatient = { profile: PatientProfile };

type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  type: string;
  patient: AppPatient;
};

type DiagPatient = { profile: PatientProfile };
type Diagnostic = {
  id: string;
  urgency: string;
  status: string;
  possibleConditions: unknown;
  rawReport: string;
  suggestedSpecialty?: string;
  createdAt: string;
  patient?: DiagPatient;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADIENTS = [
  "linear-gradient(135deg,#60A5FA,#3B82F6)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#F9A8D4,#EC4899)",
  "linear-gradient(135deg,#FCD34D,#F59E0B)",
  "linear-gradient(135deg,#A78BFA,#7C3AED)",
  "linear-gradient(135deg,#FB923C,#F97316)",
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

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatRelative(dateStr: string) {
  const diffH = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3_600_000);
  if (diffH < 1)  return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  if (diffH < 48) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function diagTitle(diag: { possibleConditions: unknown; rawReport: string }): string {
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, iconBg, icon, accent,
}: {
  label: string; value: string | number; sub: string;
  iconBg: string; icon: React.ReactNode; accent: string;
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

// ─── Appointment Row ──────────────────────────────────────────────────────────

function AppointmentRow({
  name, initial, gradient, time, type, statusLabel, statusColor, statusBg,
}: {
  name: string; initial: string; gradient: string; time: string;
  type: string; statusLabel: string; statusColor: string; statusBg: string;
}) {
  return (
    <div className="flex items-center gap-3.5 py-3 border-b border-[#F1F5F9] last:border-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] text-white flex-shrink-0" style={{ background: gradient }}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-[14px] text-[#0F172A]">{name}</p>
        <p className="text-[12px] text-[#64748B]">{time} · {type}</p>
      </div>
      <span className="font-heading font-bold text-[10px] px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: statusColor, background: statusBg }}>
        {statusLabel}
      </span>
    </div>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({
  patientName, initial, urgency, urgencyColor, urgencyBg, urgencyBorder, title, time,
}: {
  patientName: string; initial: string; urgency: string;
  urgencyColor: string; urgencyBg: string; urgencyBorder: string;
  title: string; time: string;
}) {
  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[14px] p-3.5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#60A5FA,#3B82F6)" }}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="font-heading font-semibold text-[13px] text-[#0F172A]">{patientName}</p>
          <span className="text-[11px] text-[#94A3B8]">{time}</span>
        </div>
        <p className="text-[13px] text-[#64748B] mb-2 line-clamp-2">{title}</p>
        <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full border" style={{ color: urgencyColor, background: urgencyBg, borderColor: urgencyBorder }}>
          {urgency}
        </span>
      </div>
      <Link href="/dashboard/doctor/reviews" className="font-heading font-semibold text-[12px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors whitespace-nowrap self-center">
        Review →
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorDashboard() {
  const [userName, setUserName] = useState("");
  const [userInitial, setUserInitial] = useState("?");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Diagnostic[]>([]);

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
    apiGet<Diagnostic[]>("/diagnostics?pending=true").then(setPendingReviews).catch(() => {});
  }, []);

  const todayStr = new Date().toDateString();
  const todayAppts = appointments.filter(
    (a) => new Date(a.scheduledAt).toDateString() === todayStr && a.status !== "CANCELLED",
  );
  const completedToday = todayAppts.filter((a) => a.status === "COMPLETED").length;
  const remainingToday = todayAppts.filter(
    (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED" || a.status === "IN_PROGRESS",
  ).length;
  const totalAppts = appointments.filter((a) => a.status !== "CANCELLED").length;

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">Doctor Dashboard</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/doctor/availability"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] font-heading font-semibold text-[13px] text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Set Availability
          </Link>
          <NotificationBell />
          <div
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[14px] text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}
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
            {greeting}, Dr. {userName ? userName.split(" ")[0] : "there"} 👋
          </h1>
          <p className="text-[15px] text-[#64748B]">Here&apos;s your schedule and pending reviews for today.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          <StatCard
            label="Appointments Today"
            value={todayAppts.length}
            sub={`${remainingToday} remaining`}
            iconBg="#EFF6FF"
            accent="#2563EB"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
          />
          <StatCard
            label="Pending Reviews"
            value={pendingReviews.length}
            sub="AI diagnostics"
            iconBg="#FFF1F2"
            accent="#E11D48"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="16" y2="17" />
              </svg>
            }
          />
          <StatCard
            label="Total Appointments"
            value={totalAppts}
            sub="all time"
            iconBg="#F0FDF4"
            accent="#059669"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
          />
          <StatCard
            label="Completed Today"
            value={completedToday}
            sub="sessions"
            iconBg="#F3F0FF"
            accent="#7C3AED"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Today's Schedule */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-[16px] text-[#0F172A]">Today&apos;s Schedule</h2>
              <Link href="/dashboard/doctor/appointments" className="font-heading font-semibold text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                View all
              </Link>
            </div>

            {todayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No appointments today</p>
                <p className="text-[12px] text-[#CBD5E1] mt-1">Your schedule is clear</p>
              </div>
            ) : (
              <div>
                {todayAppts.slice(0, 4).map((appt, i) => {
                  const name = `${appt.patient.profile.firstName} ${appt.patient.profile.lastName}`;
                  const { label, color, bg } = statusStyle(appt.status);
                  return (
                    <AppointmentRow
                      key={appt.id}
                      name={name}
                      initial={name.charAt(0).toUpperCase()}
                      gradient={GRADIENTS[i % GRADIENTS.length]}
                      time={formatTime(appt.scheduledAt)}
                      type={appt.type === "IN_PERSON" ? "In-Person" : "Online"}
                      statusLabel={label}
                      statusColor={color}
                      statusBg={bg}
                    />
                  );
                })}
              </div>
            )}

            <Link
              href="/dashboard/doctor/appointments"
              className="mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-[14px] text-white hover:shadow-lg hover:-translate-y-0.5 transition-all"
              style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 3px 12px rgba(37,99,235,0.25)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Manage Appointments
            </Link>
          </div>

          {/* Pending Diagnostic Reviews */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-[16px] text-[#0F172A]">Pending Reviews</h2>
                {pendingReviews.length > 0 && (
                  <span className="font-heading font-bold text-[10px] px-1.5 py-0.5 rounded-full text-white bg-[#EF4444]">
                    {pendingReviews.length}
                  </span>
                )}
              </div>
              <Link href="/dashboard/doctor/reviews" className="font-heading font-semibold text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                View all
              </Link>
            </div>

            {pendingReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No pending reviews</p>
                <p className="text-[12px] text-[#CBD5E1] mt-1">All diagnostics have been reviewed</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingReviews.slice(0, 3).map((diag) => {
                  const u = urgencyStyle(diag.urgency);
                  const name = diag.patient
                    ? `${diag.patient.profile.firstName} ${diag.patient.profile.lastName}`
                    : "Unknown Patient";
                  return (
                    <ReviewCard
                      key={diag.id}
                      patientName={name}
                      initial={name.charAt(0).toUpperCase()}
                      urgency={u.label}
                      urgencyColor={u.color}
                      urgencyBg={u.bg}
                      urgencyBorder={u.border}
                      title={diagTitle(diag)}
                      time={formatRelative(diag.createdAt)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Profile completion banner */}
        <div
          className="flex items-center justify-between px-6 py-5 rounded-[20px] border border-[#DDD6FE]"
          style={{ background: "linear-gradient(135deg,#F5F3FF,#EDE9FE)" }}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[14px] bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <div>
              <p className="font-heading font-bold text-[15px] text-[#0F172A] mb-0.5">Complete your doctor profile</p>
              <p className="text-[13px] text-[#64748B]">
                Add your specialty, bio, and consultation fee so patients can find and book you.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/doctor/profile"
            className="font-heading font-semibold text-[13px] text-white px-5 py-2.5 rounded-[10px] bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors whitespace-nowrap flex-shrink-0"
            style={{ boxShadow: "0 2px 8px rgba(124,58,237,0.25)" }}
          >
            Update Profile
          </Link>
        </div>
      </main>
    </>
  );
}
