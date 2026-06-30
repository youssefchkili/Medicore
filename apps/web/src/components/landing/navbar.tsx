"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-[16px] bg-white/80 shadow-sm border-b border-[#E2E8F0]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-10 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[9px] bg-[#2563EB] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="7.25" y="2" width="1.5" height="12" rx="0.75" fill="white" />
              <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="white" />
            </svg>
          </div>
          <span className="font-heading font-bold text-[#0F172A] text-lg tracking-tight">
            MediCore
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "How it Works", href: "#how-it-works" },
            { label: "Features", href: "#features" },
            { label: "For Doctors", href: "#for-doctors" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[#64748B] hover:text-[#0F172A] text-sm font-medium transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] transition-colors shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
