"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { parseAiReport, DEFAULT_AI_DISCLAIMER } from "@/lib/parseAiReport";

type DiagnosticStatus = "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED";
type Urgency = "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
type Condition = { condition: string; confidence?: string } | string;

type Diagnostic = {
  id: string;
  status: DiagnosticStatus;
  urgency: Urgency;
  possibleConditions: Condition[];
  rawReport: string;
  suggestedSpecialty: string | null;
  doctorNotes: string | null;
  reviewedBy: string | null;
  createdAt: string;
  patient: { profile: { firstName: string; lastName: string } } | null;
};

function conditionName(c: Condition): string {
  return typeof c === "string" ? c : c.condition;
}
function conditionConfidence(c: Condition): string | null {
  return typeof c === "string" ? null : (c.confidence ?? null);
}

const URGENCY_STYLES: Record<Urgency, { label: string; color: string; bg: string; border: string }> = {
  LOW:       { label: "🟢 LOW",       color: "#059669", bg: "#ECFDF5", border: "#6EE7B7" },
  MEDIUM:    { label: "⚡ MEDIUM",    color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  HIGH:      { label: "🔴 HIGH",      color: "#EA580C", bg: "#FFF7ED", border: "#FDBA74" },
  EMERGENCY: { label: "🚨 EMERGENCY", color: "#BE123C", bg: "#FFF1F2", border: "#FECDD3" },
};

type Tab = "pending" | "reviewed";

export default function DoctorReviewsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<Diagnostic[]>([]);
  const [reviewed, setReviewed] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Diagnostic | null>(null);
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState<"REVIEWED" | "ARCHIVED">("REVIEWED");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet<Diagnostic[]>("/diagnostics?pending=true"),
      apiGet<Diagnostic[]>("/diagnostics"),
    ])
      .then(([p, r]) => {
        setPending(p);
        setReviewed(r);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmitReview() {
    if (!reviewing) return;
    setSubmitLoading(true);
    try {
      await apiPatch(`/diagnostics/${reviewing.id}/review`, {
        status: newStatus,
        doctorNotes: notes || undefined,
      });
      setPending((prev) => prev.filter((d) => d.id !== reviewing.id));
      const updated: Diagnostic = { ...reviewing, status: newStatus, doctorNotes: notes };
      setReviewed((prev) => [updated, ...prev]);
      setReviewing(null);
      setNotes("");
      setNewStatus("REVIEWED");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSubmitLoading(false);
    }
  }

  const list = tab === "pending" ? pending : reviewed;

  function patientName(d: Diagnostic) {
    if (!d.patient) return "Unknown Patient";
    return `${d.patient.profile.firstName} ${d.patient.profile.lastName}`;
  }

  function patientInitial(d: Diagnostic) {
    return d.patient?.profile.firstName.charAt(0).toUpperCase() ?? "?";
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">Medical Reviews</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <NotificationBell />
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {error && (
          <div className="mb-5 p-4 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("pending")}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] transition-all"
            style={{
              background: tab === "pending" ? "#EF4444" : "#fff",
              color: tab === "pending" ? "#fff" : "#64748B",
              border: tab === "pending" ? "none" : "1px solid #E2E8F0",
            }}
          >
            Pending Review
            {pending.length > 0 && (
              <span
                className="font-heading font-bold text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === "pending" ? "rgba(255,255,255,0.3)" : "#EF4444",
                  color: "#fff",
                }}
              >
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("reviewed")}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] transition-all"
            style={{
              background: tab === "reviewed" ? "#2563EB" : "#fff",
              color: tab === "reviewed" ? "#fff" : "#64748B",
              border: tab === "reviewed" ? "none" : "1px solid #E2E8F0",
            }}
          >
            Reviewed
            <span
              className="font-heading font-bold text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: tab === "reviewed" ? "rgba(255,255,255,0.3)" : "#F1F5F9",
                color: tab === "reviewed" ? "#fff" : "#64748B",
              }}
            >
              {reviewed.length}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
              <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[16px] text-[#0F172A] mb-1">
              {tab === "pending" ? "No pending reviews" : "No reviewed diagnostics"}
            </p>
            <p className="text-[14px] text-[#64748B]">
              {tab === "pending"
                ? "All patient diagnostics are up to date."
                : "Diagnostics you review will appear here."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {list.map((d) => {
              const u = URGENCY_STYLES[d.urgency];
              const age = (() => {
                const diff = Date.now() - new Date(d.createdAt).getTime();
                const h = Math.floor(diff / 3600000);
                if (h < 1) return "Just now";
                if (h < 24) return `${h}h ago`;
                return `${Math.floor(h / 24)}d ago`;
              })();
              return (
                <div
                  key={d.id}
                  className="bg-white border border-[#E2E8F0] rounded-[16px] p-5"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#60A5FA,#3B82F6)" }}
                    >
                      {patientInitial(d)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-heading font-semibold text-[15px] text-[#0F172A]">{patientName(d)}</p>
                        <span className="text-[12px] text-[#94A3B8]">{age}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span
                          className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full border"
                          style={{ color: u.color, background: u.bg, borderColor: u.border }}
                        >
                          {u.label}
                        </span>
                        {d.suggestedSpecialty && (
                          <span className="font-heading font-semibold text-[10px] px-2 py-0.5 rounded-full bg-[#F3F0FF] text-[#7C3AED]">
                            {d.suggestedSpecialty}
                          </span>
                        )}
                      </div>
                      {Array.isArray(d.possibleConditions) && d.possibleConditions.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {d.possibleConditions.slice(0, 5).map((c, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]">
                              {conditionName(c)}
                            </span>
                          ))}
                          {d.possibleConditions.length > 5 && (
                            <span className="text-[11px] text-[#94A3B8]">+{d.possibleConditions.length - 5} more</span>
                          )}
                        </div>
                      )}
                      {d.rawReport && (
                        <p className="text-[13px] text-[#64748B] mb-3 line-clamp-2">
                          {parseAiReport(d.rawReport).symptomsSummary ?? d.rawReport}
                        </p>
                      )}
                      {d.doctorNotes && tab === "reviewed" && (
                        <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] mb-3">
                          <p className="text-[12px] font-heading font-semibold text-[#059669] mb-0.5">Your notes</p>
                          <p className="text-[13px] text-[#047857]">{d.doctorNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {tab === "pending" && (
                    <div className="mt-4 pt-4 border-t border-[#F1F5F9] flex justify-end">
                      <button
                        onClick={() => { setReviewing(d); setNotes(""); setNewStatus("REVIEWED"); }}
                        className="px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
                      >
                        Write Review
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Review modal */}
      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setReviewing(null); }}
        >
          <div className="bg-white rounded-[20px] w-full max-w-lg p-6" style={{ animation: "fadeInUp 0.25s ease both" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-[18px] text-[#0F172A]">Write Review</h2>
                <p className="text-[13px] text-[#64748B]">{patientName(reviewing)}</p>
              </div>
              <button onClick={() => setReviewing(null)} className="w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {Array.isArray(reviewing.possibleConditions) && reviewing.possibleConditions.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-heading font-semibold text-[#94A3B8] uppercase mb-1.5">Possible Conditions</p>
                <div className="flex gap-1.5 flex-wrap">
                  {reviewing.possibleConditions.map((c, i) => {
                    const conf = conditionConfidence(c);
                    return (
                      <span key={i} className="text-[12px] px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#374151]">
                        {conditionName(c)}{conf && <span className="text-[#94A3B8]"> · {conf}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {reviewing.rawReport && (() => {
              const parsed = parseAiReport(reviewing.rawReport);
              return (
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mb-4 flex flex-col gap-3">
                  <div>
                    <p className="text-[11px] font-heading font-semibold text-[#94A3B8] uppercase mb-1.5">AI Report</p>
                    <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">
                      {parsed.symptomsSummary ?? parsed.raw}
                    </p>
                  </div>
                  {parsed.recommendations && (
                    <div>
                      <p className="text-[11px] font-heading font-semibold text-[#94A3B8] uppercase mb-1.5">AI Recommendations</p>
                      <p className="text-[13px] text-[#374151] leading-relaxed">{parsed.recommendations}</p>
                    </div>
                  )}
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px] bg-[#FFFBEB] border border-[#FDE68A]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <p className="text-[11px] text-[#92400E] leading-relaxed">
                      {parsed.disclaimer ?? DEFAULT_AI_DISCLAIMER}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="mb-4">
              <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-2">Your Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write your clinical notes, treatment plan, or follow-up instructions…"
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] resize-none"
              />
            </div>

            <div className="mb-5">
              <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-2">Mark as</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewStatus("REVIEWED")}
                  className="flex-1 py-2.5 rounded-xl font-heading font-semibold text-[13px] transition-all"
                  style={{
                    background: newStatus === "REVIEWED" ? "#059669" : "#F8FAFC",
                    color: newStatus === "REVIEWED" ? "#fff" : "#64748B",
                    border: newStatus === "REVIEWED" ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  Reviewed
                </button>
                <button
                  type="button"
                  onClick={() => setNewStatus("ARCHIVED")}
                  className="flex-1 py-2.5 rounded-xl font-heading font-semibold text-[13px] transition-all"
                  style={{
                    background: newStatus === "ARCHIVED" ? "#64748B" : "#F8FAFC",
                    color: newStatus === "ARCHIVED" ? "#fff" : "#64748B",
                    border: newStatus === "ARCHIVED" ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  Archive
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setReviewing(null)}
                className="flex-1 py-3 rounded-[12px] font-heading font-semibold text-[14px] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitLoading}
                className="flex-1 py-3 rounded-[12px] font-heading font-semibold text-[14px] text-white transition-colors disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
              >
                {submitLoading ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
