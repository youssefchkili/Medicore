"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type Condition = { condition: string; confidence?: string } | string;

type PreDiagnostic = {
  id: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
  status: "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED";
  suggestedSpecialty: string | null;
  possibleConditions: Condition[];
  rawReport: string;
  symptoms: Record<string, unknown>;
  createdAt: string;
  doctorNotes: string | null;
  doctor?: { profile?: { firstName: string; lastName: string } } | null;
};

const CONFIDENCE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  high:   { color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7" },
  medium: { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  low:    { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
};

function conditionName(c: Condition): string {
  return typeof c === "string" ? c : c.condition;
}
function conditionConfidence(c: Condition): string | null {
  return typeof c === "string" ? null : (c.confidence?.toLowerCase() ?? null);
}

const URGENCY_META = {
  LOW: { label: "🟢 LOW", color: "#059669", bg: "#ECFDF5", border: "#6EE7B7" },
  MEDIUM: { label: "⚡ MEDIUM", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  HIGH: { label: "🔴 HIGH", color: "#EA580C", bg: "#FFF7ED", border: "#FDBA74" },
  EMERGENCY: { label: "🚨 EMERGENCY", color: "#BE123C", bg: "#FFF1F2", border: "#FECDD3" },
};

const STATUS_META = {
  PENDING_REVIEW: { label: "PENDING REVIEW", color: "#D97706", bg: "#FFFBEB" },
  REVIEWED: { label: "REVIEWED", color: "#059669", bg: "#ECFDF5" },
  ARCHIVED: { label: "ARCHIVED", color: "#94A3B8", bg: "#F1F5F9" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d !== 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DiagnosticModal({ diag, onClose }: { diag: PreDiagnostic; onClose: () => void }) {
  const urgency = URGENCY_META[diag.urgency];
  const statusMeta = STATUS_META[diag.status];
  const conditions: Condition[] = Array.isArray(diag.possibleConditions) ? diag.possibleConditions : [];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div
        className="bg-white rounded-[24px] w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-[#F1F5F9] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-heading font-bold text-[11px] px-2.5 py-0.5 rounded-full border"
                style={{ color: urgency.color, background: urgency.bg, borderColor: urgency.border }}>
                {urgency.label}
              </span>
              <span className="font-heading font-bold text-[11px] px-2.5 py-0.5 rounded-full"
                style={{ color: statusMeta.color, background: statusMeta.bg }}>
                {statusMeta.label}
              </span>
            </div>
            <h2 className="font-heading font-bold text-[20px] text-[#0F172A]">Diagnostic Report</h2>
            <p className="text-[13px] text-[#94A3B8] mt-0.5">{timeAgo(diag.createdAt)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Possible conditions */}
          {conditions.length > 0 && (
            <div>
              <p className="font-heading font-semibold text-[12px] text-[#94A3B8] uppercase tracking-wide mb-2">Possible Conditions</p>
              <div className="flex flex-col gap-2">
                {conditions.map((c, i) => {
                  const conf = conditionConfidence(c);
                  const style = conf ? (CONFIDENCE_STYLE[conf] ?? CONFIDENCE_STYLE.low) : CONFIDENCE_STYLE.low;
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-[10px] border"
                      style={{ background: style.bg, borderColor: style.border }}>
                      <span className="font-heading font-semibold text-[13px]" style={{ color: style.color }}>
                        {conditionName(c)}
                      </span>
                      {conf && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70" style={{ color: style.color }}>
                          {conf} confidence
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested specialty */}
          {diag.suggestedSpecialty && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <div>
                <p className="text-[11px] text-[#94A3B8]">Suggested Specialty</p>
                <p className="font-heading font-semibold text-[14px] text-[#0F172A]">{diag.suggestedSpecialty}</p>
              </div>
              <Link
                href="/dashboard/patient/doctors"
                className="ml-auto px-3 py-1.5 rounded-[8px] bg-[#2563EB] text-white font-heading font-semibold text-[12px] hover:bg-[#1D4ED8] transition-colors"
              >
                Find Doctor
              </Link>
            </div>
          )}

          {/* AI Report */}
          <div>
            <p className="font-heading font-semibold text-[12px] text-[#94A3B8] uppercase tracking-wide mb-2">AI Report</p>
            <div className="px-4 py-4 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">
              {diag.rawReport}
            </div>
          </div>

          {/* Doctor review */}
          {diag.status === "REVIEWED" && diag.doctorNotes && (
            <div>
              <p className="font-heading font-semibold text-[12px] text-[#94A3B8] uppercase tracking-wide mb-2">Doctor Review</p>
              <div className="px-4 py-4 rounded-[14px] bg-[#ECFDF5] border border-[#A7F3D0]">
                {diag.doctor?.profile && (
                  <p className="font-heading font-semibold text-[13px] text-[#064E3B] mb-2">
                    Dr. {diag.doctor.profile.firstName} {diag.doctor.profile.lastName}
                  </p>
                )}
                <p className="text-[13px] text-[#065F46] leading-relaxed">{diag.doctorNotes}</p>
              </div>
            </div>
          )}

          {/* Book appointment CTA */}
          {diag.suggestedSpecialty && (
            <Link
              href={`/dashboard/patient/appointments`}
              className="flex items-center justify-center gap-2 py-3.5 rounded-[14px] font-heading font-semibold text-[14px] text-white transition-all hover:shadow-lg"
              style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 3px 12px rgba(37,99,235,0.25)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Book Appointment
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<PreDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PreDiagnostic | null>(null);
  const [filter, setFilter] = useState<"all" | "PENDING_REVIEW" | "REVIEWED">("all");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    apiGet<PreDiagnostic[]>("/diagnostics")
      .then(setDiagnostics)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? diagnostics : diagnostics.filter((d) => d.status === filter);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">My Diagnostics</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/patient/chat"
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#2563EB] text-white font-heading font-semibold text-[13px] hover:bg-[#1D4ED8] transition-colors"
            style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            New AI Chat
          </Link>
          <NotificationBell />
        </div>
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {[
            { label: "Total Reports", value: diagnostics.length, color: "#2563EB", bg: "#EFF6FF" },
            { label: "Pending Review", value: diagnostics.filter((d) => d.status === "PENDING_REVIEW").length, color: "#D97706", bg: "#FFFBEB" },
            { label: "Reviewed", value: diagnostics.filter((d) => d.status === "REVIEWED").length, color: "#059669", bg: "#ECFDF5" },
            { label: "High Urgency", value: diagnostics.filter((d) => d.urgency === "HIGH" || d.urgency === "EMERGENCY").length, color: "#EA580C", bg: "#FFF7ED" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-[16px] border border-[#E2E8F0] p-4">
              <p className="text-[12px] text-[#94A3B8] mb-1">{card.label}</p>
              <p className="font-heading font-bold text-[28px]" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-5">
          {(["all", "PENDING_REVIEW", "REVIEWED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] transition-colors"
              style={{
                background: filter === f ? "#2563EB" : "#F8FAFC",
                color: filter === f ? "#fff" : "#64748B",
                border: filter === f ? "none" : "1px solid #E2E8F0",
              }}
            >
              {f === "all" ? "All" : f === "PENDING_REVIEW" ? "Pending Review" : "Reviewed"}
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" />
              </svg>
            </div>
            <p className="font-heading font-semibold text-[16px] text-[#0F172A] mb-1">No diagnostics yet</p>
            <p className="text-[14px] text-[#64748B] mb-5">Start an AI chat to generate your first pre-diagnostic report</p>
            <Link
              href="/dashboard/patient/chat"
              className="px-5 py-2.5 rounded-[12px] bg-[#2563EB] text-white font-heading font-semibold text-[14px] hover:bg-[#1D4ED8] transition-colors"
            >
              Start AI Chat
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((diag) => {
              const urgency = URGENCY_META[diag.urgency];
              const statusMeta = STATUS_META[diag.status];
              const conditions: Condition[] = Array.isArray(diag.possibleConditions) ? diag.possibleConditions : [];

              return (
                <div
                  key={diag.id}
                  className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px] cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
                  onClick={() => setSelected(diag)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-heading font-bold text-[10px] px-2.5 py-0.5 rounded-full border"
                        style={{ color: urgency.color, background: urgency.bg, borderColor: urgency.border }}
                      >
                        {urgency.label}
                      </span>
                      <span
                        className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full"
                        style={{ color: statusMeta.color, background: statusMeta.bg }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#94A3B8]">{timeAgo(diag.createdAt)}</span>
                  </div>

                  {conditions.length > 0 && (
                    <p className="font-heading font-semibold text-[15px] text-[#0F172A] mb-1">
                      {conditionName(conditions[0])}
                      {conditions.length > 1 && (
                        <span className="text-[12px] font-normal text-[#94A3B8] ml-1.5">
                          +{conditions.length - 1} more
                        </span>
                      )}
                    </p>
                  )}

                  {diag.suggestedSpecialty && (
                    <p className="text-[12px] text-[#64748B] mb-3">
                      Suggested: {diag.suggestedSpecialty}
                    </p>
                  )}

                  <p className="text-[12px] text-[#94A3B8] mb-4 line-clamp-2">
                    {diag.rawReport.slice(0, 120)}…
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#2563EB]">View full report →</span>
                    {diag.suggestedSpecialty && (
                      <Link
                        href="/dashboard/patient/appointments"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[12px] font-medium text-[#059669] hover:underline"
                      >
                        Book appointment
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selected && <DiagnosticModal diag={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
