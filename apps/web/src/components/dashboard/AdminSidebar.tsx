"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/client";

export default function AdminSidebar({
  userName,
  pendingCount,
}: {
  userName: string;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = userName ? userName.charAt(0).toUpperCase() : "A";

  const navItems = [
    {
      label: "Overview",
      href: "/dashboard/admin",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      label: "Doctors",
      href: "/dashboard/admin/doctors",
      badge: pendingCount > 0 ? pendingCount : undefined,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      label: "Patients",
      href: "/dashboard/admin/patients",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
        </svg>
      ),
    },
    {
      label: "Appointments",
      href: "/dashboard/admin/appointments",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      label: "Audit Logs",
      href: "/dashboard/admin/audit",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      ),
    },
  ];

  function isActive(href: string) {
    if (href === "/dashboard/admin") return pathname === "/dashboard/admin";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed top-0 left-0 w-[260px] h-screen bg-white border-r border-[#E2E8F0] flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#F1F5F9]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#D97706] rounded-[10px] flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3L3 6.5v4.5c0 3.7 2.8 7.2 6 8 3.2-.8 6-4.3 6-8V6.5L9 3z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="font-heading font-bold text-[18px] text-[#0F172A]">MediCore</span>
            <span className="ml-2 font-heading font-semibold text-[10px] text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-full">Admin</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3.5 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] transition-colors"
              style={{ background: active ? "#FFFBEB" : "transparent" }}
            >
              <span style={{ color: active ? "#D97706" : "#94A3B8" }}>{item.icon}</span>
              <span
                className="text-[14px] flex-1"
                style={{
                  fontFamily: active ? "'Plus Jakarta Sans', sans-serif" : "'DM Sans', sans-serif",
                  fontWeight: active ? 600 : 500,
                  color: active ? "#D97706" : "#64748B",
                }}
              >
                {item.label}
              </span>
              {item.badge !== undefined && (
                <span className="font-heading font-bold text-[10px] px-1.5 py-0.5 rounded-full text-white bg-[#EF4444]">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3.5 border-t border-[#F1F5F9]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#F8FAFC]">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[14px] text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#D97706,#B45309)" }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-semibold text-[13px] text-[#0F172A] truncate">{userName || "Admin"}</p>
            <p className="text-[11px] text-[#94A3B8]">Administrator</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-7 h-7 rounded-lg bg-[#FFFBEB] flex items-center justify-center hover:bg-[#FDE68A] transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
