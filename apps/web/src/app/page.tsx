import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";

// ─── Icons ────────────────────────────────────────────────────────────────────

function StarIcon() {
  return (
    <svg className="w-4 h-4 text-[#F59E0B]" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection() {
  const avatars = [
    { initial: "A", bg: "#2563EB" },
    { initial: "M", bg: "#10B981" },
    { initial: "S", bg: "#7C3AED" },
    { initial: "K", bg: "#EC4899" },
  ];

  return (
    <section className="relative min-h-screen pt-24 pb-20 overflow-hidden flex items-center">
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #CBD5E1 1.5px, transparent 1.5px)",
          backgroundSize: "44px 44px",
          opacity: 0.45,
        }}
      />
      {/* Radial gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 55% at 75% 15%, rgba(37,99,235,0.09) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 20% 85%, rgba(16,185,129,0.07) 0%, transparent 65%)",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* ── Left Column ── */}
          <div className="flex flex-col gap-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-full bg-[#EFF6FF] border border-[#BFDBFE]">
              <span
                className="w-2 h-2 rounded-full bg-[#10B981] flex-shrink-0"
                style={{ animation: "pulseDot 2s ease-in-out infinite" }}
              />
              <span className="text-xs font-semibold text-[#2563EB] tracking-wide">
                AI-Powered Telemedicine · Tunisia
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-heading text-5xl lg:text-6xl font-extrabold text-[#0F172A] leading-[1.08]"
              style={{ letterSpacing: "-2px" }}
            >
              Healthcare,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #2563EB, #10B981)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                reimagined
              </span>{" "}
              for everyone.
            </h1>

            {/* Body */}
            <p className="text-lg text-[#64748B] leading-8 max-w-lg">
              Describe your symptoms to our AI, receive a structured
              pre-diagnostic report, and connect with certified doctors — all
              from the comfort of home.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                }}
              >
                Start for free
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[#374151] text-sm font-semibold border border-[#E2E8F0] hover:border-[#BFDBFE] hover:bg-[#F8FAFC] transition-all"
              >
                <PlayIcon />
                See how it works
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                {avatars.map((a, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: a.bg }}
                  >
                    {a.initial}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <StarIcon key={i} />
                  ))}
                </div>
                <span className="text-sm font-medium text-[#374151]">
                  <span className="font-bold text-[#0F172A]">10,000+</span>{" "}
                  patients trust MediCore
                </span>
              </div>
            </div>
          </div>

          {/* ── Right Column — Floating Cards ── */}
          <div className="relative h-[460px] hidden lg:block">
            {/* Card 1: AI Chat */}
            <div
              className="absolute left-0 top-8 w-[62%] bg-white rounded-2xl p-5 shadow-[0_8px_40px_rgba(37,99,235,0.12)] border border-[#E2E8F0]"
              style={{ animation: "float1 7s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" fill="white" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">MediCore AI</p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[#10B981]"
                      style={{ animation: "pulseDot 2s ease-in-out infinite" }}
                    />
                    <span className="text-xs text-[#10B981] font-medium">Online · responding</span>
                  </div>
                </div>
              </div>
              {/* User bubble */}
              <div className="bg-[#EFF6FF] rounded-xl rounded-tl-sm px-3.5 py-2.5 mb-2 ml-auto max-w-[85%]">
                <p className="text-xs text-[#374151]">I've had a headache and fever for 3 days...</p>
              </div>
              {/* AI bubble */}
              <div className="bg-[#F1F5F9] rounded-xl rounded-tl-sm px-3.5 py-2.5">
                <span className="inline-block text-[10px] font-mono text-[#94A3B8] mb-1">symptom_collector</span>
                <p className="text-xs text-[#374151]">Let me ask a few questions to better assess your condition…</p>
              </div>
              {/* Typing dots */}
              <div className="flex gap-1 mt-3 ml-1">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]"
                    style={{ animation: `typingBounce 1.4s ease-in-out ${delay}s infinite` }}
                  />
                ))}
              </div>
            </div>

            {/* Card 2: Pre-Diagnostic Report */}
            <div
              className="absolute right-0 top-0 w-[48%] bg-white rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-[#E2E8F0]"
              style={{ animation: "float2 8s ease-in-out infinite" }}
            >
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-2">
                Pre-Diagnostic
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] text-[10px] font-bold mb-3">
                ⚡ MEDIUM
              </span>
              <p className="text-base font-bold text-[#0F172A] leading-tight mb-1">
                Tension Headache
              </p>
              <p className="text-xs text-[#64748B] mb-4">Suggested: Neurology</p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#10B981]">High · 78%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#E2E8F0]">
                <div className="h-full rounded-full bg-[#10B981]" style={{ width: "78%" }} />
              </div>
            </div>

            {/* Card 3: Appointment */}
            <div
              className="absolute right-0 top-[200px] w-[55%] bg-white rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-[#E2E8F0]"
              style={{ animation: "float3 6.5s ease-in-out infinite" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center flex-shrink-0 text-[#10B981]">
                  <CheckIcon size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Appointment Confirmed</p>
                  <p className="text-xs text-[#64748B] mt-0.5">Dr. Sarah Ahmed · Tomorrow · 2:00 PM</p>
                </div>
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold">
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Video Consultation
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsSection() {
  const stats = [
    { value: "10K+", label: "Patients" },
    { value: "500+", label: "Certified Doctors" },
    { value: "98%", label: "Patient Satisfaction", highlight: true },
    { value: "30+", label: "Medical Specialties" },
  ];

  return (
    <div className="border-y border-[#E2E8F0] bg-white">
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className={`py-8 text-center ${i < stats.length - 1 ? "md:border-r border-[#E2E8F0]" : ""} ${i % 2 === 0 ? "border-r border-[#E2E8F0] md:border-r-0" : ""} ${i < 2 ? "border-b md:border-b-0 border-[#E2E8F0]" : ""}`}
            >
              <p
                className={`font-heading text-4xl font-extrabold mb-1 ${s.highlight ? "text-[#2563EB]" : "text-[#0F172A]"}`}
                style={{ letterSpacing: "-1.5px" }}
              >
                {s.value}
              </p>
              <p className="text-sm text-[#64748B] font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      icon: (
        <svg width="22" height="22" fill="white" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
        </svg>
      ),
      color: "#2563EB",
      number: "01",
      title: "Describe Symptoms",
      body: "Chat with our AI. It asks targeted follow-up questions to fully understand your condition.",
    },
    {
      icon: (
        <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: "#2563EB",
      number: "02",
      title: "Receive Your Report",
      body: "Get a structured pre-diagnostic with urgency level, possible conditions, and specialist recommendations.",
    },
    {
      icon: (
        <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      color: "#10B981",
      number: "03",
      title: "Meet Your Doctor",
      body: "Book a video consultation. Your doctor reviews your pre-diagnostic before the session.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#F8FAFC]">
      <div className="max-w-[1280px] mx-auto px-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold tracking-wide uppercase mb-4">
            Simple Process
          </span>
          <h2
            className="font-heading text-4xl font-extrabold text-[#0F172A] mb-4"
            style={{ letterSpacing: "-1.5px" }}
          >
            How MediCore works
          </h2>
          <p className="text-[#64748B] text-lg max-w-lg mx-auto">
            From first symptom to full consultation — in just three steps.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Connector line */}
          <div
            className="absolute top-10 left-[calc(16.67%+40px)] right-[calc(16.67%+40px)] h-0.5 hidden md:block"
            style={{ background: "linear-gradient(90deg, #BFDBFE, #93C5FD)" }}
          />

          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center gap-5">
              <div
                className="w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-lg relative z-10"
                style={{ background: step.color }}
              >
                {step.icon}
              </div>
              <div>
                <span className="text-xs font-bold text-[#94A3B8] tracking-widest">{step.number}</span>
                <h3 className="font-heading text-xl font-bold text-[#0F172A] mt-1 mb-2">
                  {step.title}
                </h3>
                <p className="text-[#64748B] text-sm leading-7">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
          >
            Get started for free
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function FeaturesSection() {
  const features = [
    {
      color: "#2563EB",
      bgTint: "#EFF6FF",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: "AI Pre-Screening",
      body: "Multi-agent AI analyzes symptoms and generates a structured report in minutes.",
    },
    {
      color: "#10B981",
      bgTint: "#ECFDF5",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      title: "Certified Doctors",
      body: "500+ verified specialists across 30+ specialties, approved before joining.",
    },
    {
      color: "#7C3AED",
      bgTint: "#F5F3FF",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "Biometric Security",
      body: "ArcFace facial recognition for doctors. Patient data is end-to-end encrypted.",
    },
    {
      color: "#2563EB",
      bgTint: "#EFF6FF",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      title: "HD Video Consultations",
      body: "Crystal-clear browser-based video sessions. No downloads needed.",
    },
    {
      color: "#D97706",
      bgTint: "#FFFBEB",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Smart Diagnostics",
      body: "AI-generated reports with urgency levels, conditions, and RAG-sourced evidence.",
    },
    {
      color: "#E11D48",
      bgTint: "#FFF1F2",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Complete Medical Records",
      body: "SOAP notes, prescriptions, and history stored securely and accessible anytime.",
    },
  ];

  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-[1280px] mx-auto px-10">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#059669] text-xs font-semibold tracking-wide uppercase mb-4">
            Built for Everyone
          </span>
          <h2
            className="font-heading text-4xl font-extrabold text-[#0F172A] mb-4"
            style={{ letterSpacing: "-1.5px" }}
          >
            Everything you need
          </h2>
          <p className="text-[#64748B] text-lg max-w-lg mx-auto">
            A complete telemedicine platform designed for patients and doctors.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-7 hover:shadow-md hover:-translate-y-1 transition-all duration-200"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: f.bgTint, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="font-heading text-lg font-bold text-[#0F172A] mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-[#64748B] leading-6">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Doctors ──────────────────────────────────────────────────────────────

function ForDoctorsSection() {
  const bullets = [
    {
      color: "#2563EB",
      bg: "#EFF6FF",
      title: "Biometric Login",
      body: "Secure face recognition — no passwords, no breaches.",
    },
    {
      color: "#7C3AED",
      bg: "#F5F3FF",
      title: "Emotion Wellness Tracking",
      body: "Private AI stress and fatigue monitoring during sessions.",
    },
    {
      color: "#059669",
      bg: "#ECFDF5",
      title: "Auto SOAP Note Generation",
      body: "AI drafts your notes post-session. Edit and confirm in seconds.",
    },
    {
      color: "#2563EB",
      bg: "#EFF6FF",
      title: "Flexible Availability",
      body: "Set recurring or one-off slots. Patients book around your schedule.",
    },
  ];

  const cards = [
    {
      icon: "📋",
      color: "#2563EB",
      title: "Patient Pre-Diagnostic Ready",
      body: "Every consultation comes with a full AI report prepared before you join.",
    },
    {
      icon: "🎭",
      color: "#7C3AED",
      title: "Live Emotion Monitoring",
      body: "Real-time AI wellness check during sessions — private and secure.",
    },
    {
      icon: "📝",
      color: "#059669",
      title: "SOAP Auto-Generation",
      body: "Post-session notes drafted by AI. Review and sign in one click.",
    },
  ];

  return (
    <section
      id="for-doctors"
      className="py-24"
      style={{ background: "linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 100%)" }}
    >
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
          {/* Left */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-white border border-[#BFDBFE] text-[#2563EB] text-xs font-semibold tracking-wide uppercase mb-6">
              For Doctors
            </span>
            <h2
              className="font-heading text-4xl font-extrabold text-[#0F172A] mb-4 leading-tight"
              style={{ letterSpacing: "-1.5px" }}
            >
              Work smarter with AI-prepared patients
            </h2>
            <p className="text-[#64748B] text-lg leading-8 mb-10">
              Every consultation comes with a pre-reviewed AI diagnostic. Know
              what to expect before the patient joins.
            </p>

            <div className="flex flex-col gap-5">
              {bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: b.bg, color: b.color }}
                  >
                    <CheckIcon size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A] text-sm">{b.title}</p>
                    <p className="text-sm text-[#64748B] mt-0.5">{b.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 mt-10 px-6 py-3.5 rounded-2xl text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
            >
              Join as a Doctor
              <ArrowRightIcon />
            </Link>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-5">
            {cards.map((c, i) => (
              <div
                key={i}
                className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: `${c.color}15` }}
                  >
                    {c.icon}
                  </div>
                  <h3 className="font-heading text-base font-bold text-[#0F172A]">
                    {c.title}
                  </h3>
                </div>
                <p className="text-sm text-[#64748B] leading-6">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section
      className="py-20"
      style={{
        background: "linear-gradient(135deg, #1E40AF 0%, #1D4ED8 50%, #2563EB 100%)",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-10 text-center">
        <h2
          className="font-heading text-4xl font-extrabold text-white mb-4"
          style={{ letterSpacing: "-1.5px" }}
        >
          Start your healthcare journey today
        </h2>
        <p className="text-[#BFDBFE] text-lg mb-10 max-w-xl mx-auto">
          Join thousands of patients in Tunisia getting smarter, faster
          healthcare with MediCore.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-[#1D4ED8] text-sm font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            Create Free Account
            <ArrowRightIcon />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-7 py-3.5 rounded-2xl border-2 border-white/40 text-white text-sm font-semibold hover:bg-white/10 transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function FooterSection() {
  const links = [
    {
      heading: "Product",
      items: [
        { label: "Features", href: "#features" },
        { label: "How it Works", href: "#how-it-works" },
        { label: "For Doctors", href: "#for-doctors" },
      ],
    },
    {
      heading: "Account",
      items: [
        { label: "Sign In", href: "/login" },
        { label: "Register", href: "/login" },
        { label: "Doctor Portal", href: "/login" },
      ],
    },
    {
      heading: "Legal",
      items: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
        { label: "Cookie Policy", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-[#0F172A] text-[#94A3B8]">
      <div className="max-w-[1280px] mx-auto px-10 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-12 pb-12 border-b border-[#1E293B]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[9px] bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="7.25" y="2" width="1.5" height="12" rx="0.75" fill="white" />
                  <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="white" />
                </svg>
              </div>
              <span className="font-heading font-bold text-[#F1F5F9] text-lg tracking-tight">
                MediCore
              </span>
            </div>
            <p className="text-sm leading-7 max-w-xs">
              AI-powered telemedicine for Tunisia. Modern healthcare, anywhere,
              anytime.
            </p>
          </div>

          {/* Link groups */}
          {links.map((group) => (
            <div key={group.heading}>
              <p className="text-[#F1F5F9] text-sm font-semibold mb-4">
                {group.heading}
              </p>
              <ul className="flex flex-col gap-3">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#475569]">
            © 2025 MediCore. All rights reserved. Made with care in Tunisia.
          </p>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-[#10B981]"
              style={{ animation: "pulseDot 2s ease-in-out infinite" }}
            />
            <span className="text-xs text-[#475569]">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-white overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <StatsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <ForDoctorsSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}
