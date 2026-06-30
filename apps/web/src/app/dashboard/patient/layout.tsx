"use client";

import { useState, useEffect } from "react";
import PatientSidebar from "@/components/dashboard/PatientSidebar";
import { createClient } from "@/lib/client";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      const user = userData.user;
      if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      }

      // Safety: ensure the NestJS profile row exists (idempotent upsert).
      // This covers the case where sync-profile was skipped at login (e.g. email confirmation flow).
      const token = sessionData.session?.access_token;
      if (user && token) {
        const fullName: string = user.user_metadata?.full_name || "";
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || user.email?.split("@")[0] || "User";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;
        const role = (user.user_metadata?.role as string || "PATIENT").toUpperCase();
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ firstName, lastName, role }),
        }).catch(() => {});
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <PatientSidebar userName={userName} />
      <div className="ml-[260px] flex-1 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
