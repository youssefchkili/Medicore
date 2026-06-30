"use client";

import { useState, useEffect, useRef } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const TYPE_META: Record<string, { icon: React.ReactNode; iconBg: string }> = {
  DIAGNOSTIC_READY: {
    iconBg: "#ECFDF5",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" />
      </svg>
    ),
  },
  APPOINTMENT_CONFIRMED: {
    iconBg: "#EFF6FF",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  APPOINTMENT_CANCELLED: {
    iconBg: "#FFF1F2",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    ),
  },
  SESSION_STARTED: {
    iconBg: "#F5F3FF",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
  },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<Notification[]>("/notifications").then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    await apiPatch("/notifications/read-all").catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center relative hover:bg-[#F1F5F9] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.8">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] border-2 border-white" />
        )}
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+8px)] right-0 w-80 bg-white rounded-2xl border border-[#E2E8F0] z-[200] overflow-hidden"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}
        >
          <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-[#F1F5F9]">
            <span className="font-heading font-bold text-[14px] text-[#0F172A]">
              Notifications {unreadCount > 0 && <span className="ml-1 text-[#2563EB]">({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[12px] font-medium text-[#2563EB] bg-transparent border-none cursor-pointer hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-[13px] text-[#94A3B8]">
              No notifications
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 10).map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.APPOINTMENT_CONFIRMED;
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-[18px] py-3.5 border-b border-[#F1F5F9] last:border-b-0"
                    style={{ background: !n.isRead ? "#F0F9FF" : "#fff" }}
                  >
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background: meta.iconBg }}
                    >
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-[13px] text-[#0F172A] mb-0.5">{n.title}</p>
                      <p className="text-[12px] text-[#64748B]">{n.body}</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#2563EB] flex-shrink-0 mt-1" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
