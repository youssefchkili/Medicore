"use client";

import { useState, useEffect, useRef } from "react";
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
    invalid_credentials: "Invalid email or password.",
    over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
    user_not_found: "No account found with this email.",
    email_not_confirmed: "Please confirm your email before signing in.",
  };
  if (err.code && codes[err.code]) return codes[err.code];
  const msg = err.message ?? "";
  if (msg && msg !== "{}") return msg;
  return "Sign in failed. Please check your credentials and try again.";
}

// ─── Face Verify Modal ────────────────────────────────────────────────────────

function FaceVerifyModal({
  token,
  onSuccess,
  onSkip,
}: {
  token: string;
  onSuccess: () => void;
  onSkip: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setCameraReady(true));
        }
      })
      .catch(() => setError("Camera access denied."));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleVerify() {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    setVerifying(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Capture failed"))), "image/jpeg", 0.9)
      );

      const fd = new FormData();
      fd.append("photo", blob, "verify.jpg");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/ai-proxy/face/verify`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        }
      );
      const data = (await res.json()) as { success: boolean; similarity_score: number };

      if (!res.ok || !data.success) {
        setError(
          `Face not recognized (similarity: ${(data.similarity_score * 100).toFixed(0)}%). Please try again or skip.`
        );
        return;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="bg-white rounded-[24px] w-full max-w-[400px] p-6"
        style={{ animation: "fadeInUp 0.3s ease both" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8">
              <path d="M12 3L4 7v5c0 4.6 3.5 8.9 8 10 4.5-1.1 8-5.4 8-10V7L12 3z" />
            </svg>
          </div>
          <div>
            <p className="font-heading font-bold text-[17px] text-[#0F172A]">Biometric Verification</p>
            <p className="text-[12px] text-[#64748B]">Look at the camera and verify your identity</p>
          </div>
        </div>

        {/* Camera */}
        <div className="relative rounded-[16px] overflow-hidden bg-[#0F172A] mb-4" style={{ aspectRatio: "4/3" }}>
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {!cameraReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-36 h-44 rounded-[50%] border-2 border-dashed border-white/40" />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[10px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[13px]">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-3 rounded-[12px] font-heading font-semibold text-[14px] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={!cameraReady || verifying}
            className="flex-[2] py-3 rounded-[12px] font-heading font-semibold text-[14px] text-white disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
          >
            {verifying ? "Verifying…" : "Verify Face"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Left panel decorative cards ─────────────────────────────────────────────

function FloatingCards() {
  return (
    <div className="flex flex-col gap-3.5 relative z-10">
      {/* Card 1 — AI Pre-Diagnostic */}
      <div
        className="flex items-center gap-3.5 px-5 py-4 rounded-[18px] border border-white/20"
        style={{
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(20px)",
          animation: "float1 6s ease-in-out infinite",
        }}
      >
        <div className="w-11 h-11 rounded-[14px] bg-white/20 flex items-center justify-center flex-shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div>
          <p className="font-heading font-semibold text-sm text-white mb-0.5">
            AI Pre-Diagnostic Complete
          </p>
          <p className="text-xs text-white/65">
            Tension headache · Medium urgency · Neurology
          </p>
        </div>
        <div className="ml-auto w-9 h-9 rounded-full bg-[#10B981]/30 flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      {/* Card 2 — Doctor session */}
      <div
        className="flex items-center gap-3.5 px-5 py-4 rounded-[18px] border border-white/20"
        style={{
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(20px)",
          animation: "float2 7s ease-in-out 0.8s infinite",
        }}
      >
        <div className="w-11 h-11 rounded-[14px] bg-white/20 flex items-center justify-center flex-shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <rect x="2" y="6" width="14" height="11" rx="2" />
            <path d="M16 9.5l6-3.5v12l-6-3.5" />
          </svg>
        </div>
        <div>
          <p className="font-heading font-semibold text-sm text-white mb-0.5">
            Dr. Sarah Ahmed
          </p>
          <p className="text-xs text-white/65">Session starts in 10 min · Ready</p>
        </div>
        <div
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/15"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#34D399] inline-block"
            style={{ animation: "pulseDot 2s ease-in-out infinite" }}
          />
          <span className="font-heading font-semibold text-[11px] text-white">Live</span>
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl transition-all duration-150 cursor-pointer"
      style={{
        border: `1.5px solid ${active ? "#2563EB" : "#E2E8F0"}`,
        background: active ? "#EFF6FF" : "#fff",
        color: active ? "#2563EB" : "#94A3B8",
      }}
    >
      {icon}
      <span
        className="font-heading font-semibold text-xs"
        style={{ color: active ? "#2563EB" : "#94A3B8" }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [role, setRole] = useState<Role>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [faceVerifyToken, setFaceVerifyToken] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(parseAuthError(authError));
      setLoading(false);
      return;
    }

    // user_metadata.role is written during signup; app_metadata.role is server-set fallback
    const metaRole =
      (data.user?.user_metadata?.role as Role) ||
      (data.user?.app_metadata?.role as Role) ||
      role;

    // Ensure the profile row exists in the DB (upsert is idempotent).
    // Always call sync-profile so the profile is created even when fullName is missing.
    if (data.session) {
      const fullName: string = data.user?.user_metadata?.full_name || "";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || data.user?.email?.split("@")[0] || "User";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ firstName, lastName, role: metaRole.toUpperCase() }),
        });
      } catch {
        // Non-fatal
      }
    }

    // For doctors: check profile status and face biometric
    if (metaRole === "doctor" && data.session) {
      try {
        const profileRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/me`,
          { headers: { Authorization: `Bearer ${data.session.access_token}` } }
        );
        if (profileRes.ok) {
          const profile = await profileRes.json() as {
            isActive?: boolean;
            doctor?: { faceRegistered?: boolean };
          };

          // Doctor pending admin approval — send to waiting page
          if (profile.isActive === false) {
            router.push("/dashboard/doctor/pending");
            router.refresh();
            return;
          }

          // Doctor has face biometric enrolled — require 2FA
          if (profile.doctor?.faceRegistered) {
            setPendingRoute(DASHBOARD_ROUTES[metaRole]);
            setFaceVerifyToken(data.session.access_token);
            setLoading(false);
            return;
          }
        }
      } catch { /* non-fatal: fall through to normal redirect */ }
    }

    router.push(DASHBOARD_ROUTES[metaRole]);
    router.refresh();
  }

  const roleIcons = {
    patient: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
      </svg>
    ),
    doctor: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    admin: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3L4 7v5c0 4.6 3.5 8.9 8 10 4.5-1.1 8-5.4 8-10V7L12 3z" />
      </svg>
    ),
  };

  return (
    <>
    <div className="flex min-h-screen">
      {/* ── LEFT — Decorative Panel ── */}
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
        {/* Decorative circles */}
        <div className="absolute -top-[120px] -right-[80px] w-[400px] h-[400px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-[80px] -left-[60px] w-[320px] h-[320px] rounded-full pointer-events-none" style={{ background: "rgba(16,185,129,0.12)" }} />

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
            className="font-heading font-extrabold text-[44px] leading-[1.1] text-white mb-4"
            style={{ letterSpacing: "-1.5px" }}
          >
            Your health,<br />at your fingertips.
          </h1>
          <p className="text-[17px] leading-[1.7] text-white/72 mb-13 max-w-[380px]" style={{ marginBottom: "52px" }}>
            AI-powered pre-diagnostics, certified doctors, and video
            consultations — all in one place.
          </p>
          <FloatingCards />
        </div>

        {/* Testimonial */}
        <div className="px-12 pb-9">
          <div
            className="rounded-2xl p-5 border border-white/12"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm leading-[1.6] text-white/80 mb-3">
              "MediCore found my diagnosis before I even got to see a doctor.
              Incredible technology."
            </p>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #F9A8D4, #EC4899)" }}
              >
                N
              </div>
              <div>
                <p className="font-heading font-semibold text-[13px] text-white">
                  Nour Ben Salem
                </p>
                <p className="text-[11px] text-white/50">Patient · Tunis</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT — Form Panel ── */}
      <div
        className="w-full lg:w-[500px] lg:flex-shrink-0 bg-white flex flex-col justify-center px-8 lg:px-[52px] py-14 overflow-y-auto"
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

        {/* Heading */}
        <div className="mb-9">
          <h2
            className="font-heading font-bold text-[30px] text-[#0F172A] mb-1.5"
            style={{ letterSpacing: "-0.75px" }}
          >
            Welcome back
          </h2>
          <p className="text-[15px] text-[#64748B]">Sign in to your MediCore account.</p>
        </div>

        {/* Role Switcher */}
        <div className="mb-7">
          <p className="font-heading font-semibold text-xs text-[#64748B] uppercase tracking-[0.5px] mb-2.5">
            I am a
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["patient", "doctor"] as Role[]).map((r) => (
              <RoleButton
                key={r}
                active={role === r}
                onClick={() => setRole(r)}
                icon={roleIcons[r]}
                label={r.charAt(0).toUpperCase() + r.slice(1)}
              />
            ))}
          </div>
        </div>

        {/* Biometric note — doctors only */}
        {role === "doctor" && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-[14px] bg-[#F0F9FF] border border-[#BAE6FD] mb-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="1.8" className="flex-shrink-0 mt-0.5">
              <path d="M12 3L4 7v5c0 4.6 3.5 8.9 8 10 4.5-1.1 8-5.4 8-10V7L12 3z" />
            </svg>
            <div>
              <p className="font-heading font-semibold text-[13px] text-[#0C4A6E] mb-0.5">
                Biometric Face Login Available
              </p>
              <p className="text-xs text-[#0369A1] leading-relaxed">
                If you&apos;ve enrolled your face, you&apos;ll be prompted for ArcFace
                verification automatically after signing in.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
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
              onFocus={(e) => {
                e.target.style.borderColor = "#2563EB";
                e.target.style.background = "#fff";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E2E8F0";
                e.target.style.background = "#F8FAFC";
              }}
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-heading font-semibold text-[13px] text-[#374151]">
                Password
              </label>
              <a href="#" className="text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-[15px] text-[#0F172A] bg-[#F8FAFC] transition-all duration-150"
              style={{ border: "1.5px solid #E2E8F0", outline: "none" }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563EB";
                e.target.style.background = "#fff";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E2E8F0";
                e.target.style.background = "#F8FAFC";
              }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-[13px] font-heading font-semibold text-[15px] text-white transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
                Signing in…
              </>
            ) : (
              <>
                Sign In to MediCore
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <span className="text-[13px] text-[#94A3B8]">or</span>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        {/* Create account */}
        <div className="text-center mb-8">
          <span className="text-[14px] text-[#64748B]">Don&apos;t have an account? </span>
          <Link
            href="/register"
            className="font-heading font-semibold text-[14px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
          >
            Create account
          </Link>
        </div>

        
      </div>
    </div>

    {faceVerifyToken && (
      <FaceVerifyModal
        token={faceVerifyToken}
        onSuccess={() => {
          setFaceVerifyToken(null);
          router.push(pendingRoute);
          router.refresh();
        }}
        onSkip={() => {
          setFaceVerifyToken(null);
          router.push(pendingRoute);
          router.refresh();
        }}
      />
    )}
    </>
  );
}
