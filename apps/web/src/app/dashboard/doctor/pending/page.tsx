"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";
import { apiGet } from "@/lib/api";

export default function DoctorPendingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) setEmail(data.user.email);
    })();
  }, []);

  async function checkStatus() {
    setChecking(true);
    try {
      const profile = await apiGet<{ isActive: boolean }>("/users/me");
      if (profile.isActive) {
        setApproved(true);
        setTimeout(() => router.push("/dashboard/doctor"), 2000);
      }
    } catch { /* noop */ } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#ECFDF5] flex items-center justify-center mx-auto mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="font-heading font-bold text-[24px] text-[#0F172A] mb-2">Account approved!</h2>
          <p className="text-[15px] text-[#64748B]">Redirecting you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-10 max-w-md w-full text-center shadow-sm">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)" }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h2 className="font-heading font-bold text-[26px] text-[#0F172A] mb-3" style={{ letterSpacing: "-0.5px" }}>
          Pending Admin Approval
        </h2>

        <p className="text-[15px] text-[#64748B] leading-relaxed mb-2">
          Your doctor account is under review by our administrators.
        </p>
        {email && (
          <p className="text-[14px] text-[#64748B] mb-8">
            We&apos;ll notify you at{" "}
            <span className="font-semibold text-[#0F172A]">{email}</span> once approved.
          </p>
        )}

        {/* Steps */}
        <div className="flex flex-col gap-3 mb-8 text-left">
          {[
            { label: "Account created", done: true },
            { label: "License & credentials submitted", done: true },
            { label: "Admin review in progress", done: false, active: true },
            { label: "Account activated", done: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                style={{
                  background: step.done ? "#059669" : step.active ? "#D97706" : "#F1F5F9",
                  color: step.done || step.active ? "#fff" : "#94A3B8",
                }}
              >
                {step.done ? "✓" : step.active ? "…" : i + 1}
              </div>
              <p
                className="text-[14px]"
                style={{
                  color: step.done ? "#059669" : step.active ? "#D97706" : "#94A3B8",
                  fontWeight: step.active ? 600 : 400,
                }}
              >
                {step.label}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={checkStatus}
          disabled={checking}
          className="w-full py-3.5 rounded-[13px] font-heading font-semibold text-[15px] text-white transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 mb-3"
          style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 4px 16px rgba(37,99,235,0.25)" }}
        >
          {checking ? "Checking…" : "Check Approval Status"}
        </button>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-[13px] font-heading font-semibold text-[14px] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
