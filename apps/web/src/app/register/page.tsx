"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/client";

type Role = "patient" | "doctor" | "admin";

const DASHBOARD_ROUTES: Record<Role, string> = {
  patient: "/dashboard/patient",
  doctor: "/dashboard/doctor",
  admin: "/dashboard/admin",
};

function parseAuthError(err: { message?: string; code?: string }): string {
  const codes: Record<string, string> = {
    user_already_exists: "An account with this email already exists. Try signing in instead.",
    email_address_invalid: "Please enter a valid email address.",
    weak_password: "Password is too weak. Use at least 8 characters.",
    over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
    email_address_not_authorized: "This email address is not allowed to sign up.",
  };
  if (err.code && codes[err.code]) return codes[err.code];
  const msg = err.message ?? "";
  if (msg && msg !== "{}") return msg;
  return "Something went wrong. Please check your details and try again.";
}

// ─── Left panel — same as login ───────────────────────────────────────────────

function LeftPanel() {
  return (
    <div
      className="flex-1 hidden lg:flex flex-col relative overflow-hidden"
      style={{
        background:
          "linear-gradient(145deg, #1E3A8A 0%, #1D4ED8 40%, #2563EB 70%, #0EA5E9 100%)",
        animation: "fadeIn 0.6s ease both",
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute -top-[120px] -right-[80px] w-[400px] h-[400px] rounded-full bg-white/5 pointer-events-none" />
      <div
        className="absolute -bottom-[80px] -left-[60px] w-[320px] h-[320px] rounded-full pointer-events-none"
        style={{ background: "rgba(16,185,129,0.12)" }}
      />

      {/* Logo */}
      <div className="px-9 pt-7">
        <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
          <div
            className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-heading font-bold text-xl text-white">MediCore</span>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center px-12 pb-12">
        <h1
          className="font-heading font-extrabold text-[42px] leading-[1.1] text-white mb-4"
          style={{ letterSpacing: "-1.5px" }}
        >
          Join thousands<br />getting better care.
        </h1>
        <p
          className="text-[17px] leading-[1.7] text-white/72 max-w-[380px]"
          style={{ marginBottom: "52px" }}
        >
          Create your free account and get an AI-powered pre-diagnostic in minutes.
        </p>

        {/* Feature list */}
        <div className="flex flex-col gap-4">
          {[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ),
              text: "Describe symptoms to our AI and get a report in minutes",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ),
              text: "Book video consultations with certified doctors",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ),
              text: "Access your full medical history, anytime",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ),
              text: "End-to-end encrypted and 100% private",
            },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#10B981]/20 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <p className="text-[14px] text-white/80">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonial */}
      <div className="px-12 pb-9">
        <div
          className="rounded-2xl p-5 border border-white/12"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-sm leading-[1.6] text-white/80 mb-3">
            "Signing up took 2 minutes. The AI diagnosed my condition before the
            doctor even called — amazing."
          </p>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #A5B4FC, #7C3AED)" }}
            >
              K
            </div>
            <div>
              <p className="font-heading font-semibold text-[13px] text-white">
                Karim Mansour
              </p>
              <p className="text-[11px] text-white/50">Patient · Sfax</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Role button ──────────────────────────────────────────────────────────────

function RoleButton({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all duration-150 cursor-pointer"
      style={{
        border: `1.5px solid ${active ? "#2563EB" : "#E2E8F0"}`,
        background: active ? "#EFF6FF" : "#fff",
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: active ? "#DBEAFE" : "#F1F5F9",
          color: active ? "#2563EB" : "#94A3B8",
        }}
      >
        {icon}
      </div>
      <div>
        <p
          className="font-heading font-semibold text-sm"
          style={{ color: active ? "#2563EB" : "#374151" }}
        >
          {label}
        </p>
        <p className="text-xs text-[#94A3B8]">{description}</p>
      </div>
      {active && (
        <div className="ml-auto w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = "role" | "details" | "success";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role>("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const roleConfig = {
    patient: {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
        </svg>
      ),
      label: "Patient",
      description: "Book appointments & get AI diagnostics",
    },
    doctor: {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      label: "Doctor",
      description: "Manage consultations & patient records",
    },
    admin: {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3L4 7v5c0 4.6 3.5 8.9 8 10 4.5-1.1 8-5.4 8-10V7L12 3z" />
        </svg>
      ),
      label: "Admin",
      description: "Oversee platform & manage users",
    },
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          ...(role === "doctor" && { specialty, license_number: licenseNumber }),
        },
      },
    });

    if (signUpError) {
      console.error("[register] code:", (signUpError as any).code, "| msg:", signUpError.message, "| status:", (signUpError as any).status);
      setError(parseAuthError(signUpError));
      setLoading(false);
      return;
    }

    // If Supabase returned a session the account is auto-confirmed —
    // sync the profile to the DB then go straight to the dashboard
    if (signUpData.session) {
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUpData.session.access_token}`,
          },
          body: JSON.stringify({ firstName, lastName, role: role.toUpperCase() }),
        });
      } catch {
        // Non-fatal: profile sync can be retried; don't block navigation
      }
      router.push(DASHBOARD_ROUTES[role]);
      router.refresh();
      return;
    }

    // No session → email confirmation required
    setStep("success");
  }

  // ── Step 1: Role selection ──
  if (step === "role") {
    return (
      <div className="flex min-h-screen">
        <LeftPanel />
        <div
          className="w-full lg:w-[520px] lg:flex-shrink-0 bg-white flex flex-col justify-center px-8 lg:px-[52px] py-14 overflow-y-auto"
          style={{ animation: "fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s both" }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-[9px] bg-[#2563EB] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-heading font-bold text-lg text-[#0F172A]">MediCore</span>
          </div>

          <div className="mb-8">
            <h2
              className="font-heading font-bold text-[28px] text-[#0F172A] mb-1.5"
              style={{ letterSpacing: "-0.75px" }}
            >
              Create your account
            </h2>
            <p className="text-[15px] text-[#64748B]">
              Who are you joining MediCore as?
            </p>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            {(["patient", "doctor", "admin"] as Role[]).map((r) => (
              <RoleButton
                key={r}
                active={role === r}
                onClick={() => setRole(r)}
                icon={roleConfig[r].icon}
                label={roleConfig[r].label}
                description={roleConfig[r].description}
              />
            ))}
          </div>

          {/* Doctor note */}
          {role === "doctor" && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-[14px] bg-[#F0F9FF] border border-[#BAE6FD] mb-6">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="1.8" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <p className="text-xs text-[#0369A1] leading-relaxed">
                Doctor accounts require verification. Please have your medical
                license number ready. Your account will be reviewed within 24 hours.
              </p>
            </div>
          )}

          {/* Admin note */}
          {role === "admin" && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-[14px] bg-[#FFFBEB] border border-[#FDE68A] mb-6">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8" className="flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs text-[#92400E] leading-relaxed">
                Admin accounts are restricted. Contact your platform administrator
                to get access credentials.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep("details")}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-[13px] font-heading font-semibold text-[15px] text-white transition-all hover:shadow-xl hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
            }}
          >
            Continue as {roleConfig[role].label}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="text-center mt-6">
            <span className="text-[14px] text-[#64748B]">Already have an account? </span>
            <Link
              href="/login"
              className="font-heading font-semibold text-[14px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Fill in details ──
  if (step === "details") {
    return (
      <div className="flex min-h-screen">
        <LeftPanel />
        <div
          className="w-full lg:w-[520px] lg:flex-shrink-0 bg-white flex flex-col justify-center px-8 lg:px-[52px] py-14 overflow-y-auto"
          style={{ animation: "fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Back + step indicator */}
          <div className="flex items-center gap-3 mb-8">
            <button
              type="button"
              onClick={() => setStep("role")}
              className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFC] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1.5 rounded-full bg-[#2563EB]" />
              <div className="w-6 h-1.5 rounded-full bg-[#2563EB]" />
              <div className="w-6 h-1.5 rounded-full bg-[#E2E8F0]" />
            </div>
          </div>

          <div className="mb-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] mb-3">
              <div style={{ color: "#2563EB" }}>{roleConfig[role].icon}</div>
              <span className="font-heading font-semibold text-xs text-[#2563EB]">
                {roleConfig[role].label}
              </span>
            </div>
            <h2
              className="font-heading font-bold text-[28px] text-[#0F172A] mb-1.5"
              style={{ letterSpacing: "-0.75px" }}
            >
              Your details
            </h2>
            <p className="text-[15px] text-[#64748B]">
              Fill in your information to complete registration.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Full name */}
            <div>
              <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">
                Full name
              </label>
              <input
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-[15px] text-[#0F172A] bg-[#F8FAFC] transition-all duration-150"
                style={{ border: "1.5px solid #E2E8F0", outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-[15px] text-[#0F172A] bg-[#F8FAFC] transition-all duration-150"
                style={{ border: "1.5px solid #E2E8F0", outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
              />
            </div>

            {/* Doctor-only fields */}
            {role === "doctor" && (
              <>
                <div>
                  <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">
                    Specialty
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cardiology, Neurology…"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-[15px] text-[#0F172A] bg-[#F8FAFC] transition-all duration-150"
                    style={{ border: "1.5px solid #E2E8F0", outline: "none" }}
                    onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
                  />
                </div>
                <div>
                  <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">
                    Medical License Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TN-MED-123456"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-[15px] text-[#0F172A] bg-[#F8FAFC] transition-all duration-150"
                    style={{ border: "1.5px solid #E2E8F0", outline: "none" }}
                    onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
                  />
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-[15px] text-[#0F172A] bg-[#F8FAFC] transition-all duration-150"
                style={{ border: "1.5px solid #E2E8F0", outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block font-heading font-semibold text-[13px] text-[#374151] mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-[15px] text-[#0F172A] bg-[#F8FAFC] transition-all duration-150"
                style={{ border: "1.5px solid #E2E8F0", outline: "none" }}
                onFocus={(e) => {
                  const match = confirmPassword === password || !confirmPassword;
                  e.target.style.borderColor = match ? "#2563EB" : "#E11D48";
                  e.target.style.background = "#fff";
                }}
                onBlur={(e) => {
                  const match = !confirmPassword || confirmPassword === password;
                  e.target.style.borderColor = match ? "#E2E8F0" : "#FECDD3";
                  e.target.style.background = "#F8FAFC";
                }}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-[#E11D48] mt-1.5">Passwords do not match.</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-[13px] font-heading font-semibold text-[15px] text-white mt-2 transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{
                background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>

            <p className="text-center text-xs text-[#94A3B8]">
              By creating an account you agree to our{" "}
              <a href="#" className="text-[#2563EB] hover:underline">Terms of Service</a>{" "}
              and{" "}
              <a href="#" className="text-[#2563EB] hover:underline">Privacy Policy</a>.
            </p>
          </form>

          <div className="text-center mt-6">
            <span className="text-[14px] text-[#64748B]">Already have an account? </span>
            <Link
              href="/login"
              className="font-heading font-semibold text-[14px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Success ──
  return (
    <div className="flex min-h-screen">
      <LeftPanel />
      <div className="w-full lg:w-[520px] lg:flex-shrink-0 bg-white flex flex-col items-center justify-center px-8 lg:px-[52px] py-14 text-center">
        <div
          className="w-20 h-20 rounded-full bg-[#ECFDF5] flex items-center justify-center mb-6"
          style={{ animation: "fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2
          className="font-heading font-bold text-[28px] text-[#0F172A] mb-3"
          style={{ letterSpacing: "-0.75px" }}
        >
          Account created!
        </h2>
        {role === "doctor" ? (
          <p className="text-[15px] text-[#64748B] max-w-sm leading-relaxed mb-8">
            Your doctor account is under review. We&apos;ll send a confirmation to{" "}
            <span className="font-semibold text-[#0F172A]">{email}</span> within 24 hours.
          </p>
        ) : (
          <p className="text-[15px] text-[#64748B] max-w-sm leading-relaxed mb-8">
            Check your inbox at{" "}
            <span className="font-semibold text-[#0F172A]">{email}</span> to confirm
            your account, then sign in.
          </p>
        )}
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-[13px] font-heading font-semibold text-[15px] text-white w-full max-w-xs transition-all hover:shadow-xl hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
          }}
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  );
}
