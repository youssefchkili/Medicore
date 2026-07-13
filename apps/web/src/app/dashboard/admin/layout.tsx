"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { createClient } from "@/lib/client";
import { apiGet } from "@/lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      // Only the account whose role is ADMIN may enter this layout
      const metaRole = (user.user_metadata?.role as string || "").toUpperCase();
      if (metaRole !== "ADMIN") {
        const fallback =
          metaRole === "DOCTOR" ? "/dashboard/doctor" : "/dashboard/patient";
        router.replace(fallback);
        return;
      }

      if (user.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name as string);
      }
      setAllowed(true);
    })();
  }, [router]);

  // Poll pending-doctor count so the sidebar badge doesn't go stale after an
  // approve/deactivate action on a different page (no shared store to invalidate from).
  useEffect(() => {
    if (!allowed) return;
    const fetchPending = () => {
      apiGet<{ pendingDoctors: number }>("/admin/stats")
        .then((s) => setPendingCount(s.pendingDoctors))
        .catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 20000);
    return () => clearInterval(interval);
  }, [allowed]);

  if (!allowed) return null;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <AdminSidebar userName={userName} pendingCount={pendingCount} />
      <div className="ml-[260px] flex-1 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
