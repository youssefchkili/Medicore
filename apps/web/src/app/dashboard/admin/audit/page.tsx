"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

type Actor = { firstName: string; lastName: string; role: string };
type AuditLog = {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  createdAt: string;
  actor: Actor;
};

function actionStyle(action: string) {
  if (action.includes("APPROVED") || action.includes("ACTIVATED"))
    return { color: "#059669", bg: "#ECFDF5", icon: "✓" };
  if (action.includes("DEACTIVATED") || action.includes("REJECTED"))
    return { color: "#DC2626", bg: "#FFF1F2", icon: "✕" };
  return { color: "#64748B", bg: "#F1F5F9", icon: "•" };
}

function roleColor(role: string) {
  if (role === "ADMIN")   return { color: "#D97706", bg: "#FFFBEB" };
  if (role === "DOCTOR")  return { color: "#2563EB", bg: "#EFF6FF" };
  return { color: "#059669", bg: "#ECFDF5" };
}

function formatFull(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiGet<AuditLog[]>("/admin/audit-logs?limit=200").then(setLogs).catch(() => {});
  }, []);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const actor = `${l.actor.firstName} ${l.actor.lastName}`.toLowerCase();
    return actor.includes(q) || l.action.toLowerCase().includes(q) || l.resourceType.toLowerCase().includes(q);
  });

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <p className="font-heading font-bold text-[17px] text-[#0F172A]">Audit Logs</p>
        <p className="text-[13px] text-[#64748B]">{logs.length} entries</p>
      </header>

      <main className="p-7 flex-1">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[14px] text-[#64748B]">Complete history of admin actions on the platform</p>
          <input
            type="text"
            placeholder="Search by actor or action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-4 py-2.5 rounded-[10px] text-[14px] bg-white border border-[#E2E8F0] outline-none focus:border-[#D97706]"
          />
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[20px] overflow-hidden">
          <div className="grid gap-4 px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]" style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr" }}>
            {["Actor", "Action", "Resource", "Timestamp"].map((h) => (
              <p key={h} className="font-heading font-semibold text-[11px] text-[#94A3B8] uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-3">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
              </svg>
              <p className="font-heading font-semibold text-[14px] text-[#94A3B8]">No audit logs found</p>
            </div>
          ) : (
            filtered.map((log) => {
              const a = actionStyle(log.action);
              const r = roleColor(log.actor.role);
              return (
                <div
                  key={log.id}
                  className="grid gap-4 px-5 py-4 border-b border-[#F8FAFC] last:border-0 items-center hover:bg-[#F8FAFC] transition-colors"
                  style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr" }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#D97706,#B45309)" }}
                    >
                      {log.actor.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading font-semibold text-[13px] text-[#0F172A] truncate">
                        {log.actor.firstName} {log.actor.lastName}
                      </p>
                      <span
                        className="font-heading font-bold text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ color: r.color, background: r.bg }}
                      >
                        {log.actor.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ color: a.color, background: a.bg }}
                    >
                      {a.icon}
                    </span>
                    <span
                      className="font-heading font-semibold text-[12px] px-2 py-0.5 rounded-full"
                      style={{ color: a.color, background: a.bg }}
                    >
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div>
                    <p className="text-[13px] text-[#64748B]">{log.resourceType}</p>
                    {log.resourceId && (
                      <p className="text-[10px] text-[#CBD5E1] font-mono truncate">{log.resourceId.slice(0, 12)}…</p>
                    )}
                  </div>

                  <p className="text-[13px] text-[#64748B]">{formatFull(log.createdAt)}</p>
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
