"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import DoctorSidebar from "@/components/dashboard/DoctorSidebar";
import { createClient } from "@/lib/client";
import { apiGet } from "@/lib/api";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [activeChecked, setActiveChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      const user = userData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      // Only the account whose role is DOCTOR may enter this layout
      const metaRole = (user.user_metadata?.role as string || "").toUpperCase();
      if (metaRole !== "DOCTOR") {
        const fallback = metaRole === "ADMIN" ? "/dashboard/admin" : "/dashboard/patient";
        router.replace(fallback);
        return;
      }

      if (user.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      }
      setAllowed(true);

      const token = sessionData.session?.access_token;
      if (user && token) {
        const fullName: string = user.user_metadata?.full_name || "";
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || user.email?.split("@")[0] || "User";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;

        // Sync profile (idempotent — won't overwrite existing)
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ firstName, lastName, role: "DOCTOR" }),
        }).catch(() => {});

        // Guard: redirect inactive (pending) doctors to the waiting page.
        // Rendering is held back (see activeChecked below) until this resolves,
        // so an inactive doctor can't see PHI in the sidebar/children for the
        // instant between mount and this check completing.
        if (!pathname.includes("/pending")) {
          apiGet<{ isActive: boolean }>("/users/me")
            .then((profile) => {
              if (!profile.isActive) {
                router.replace("/dashboard/doctor/pending");
              } else {
                setActiveChecked(true);
              }
            })
            .catch(() => setActiveChecked(true));
        } else {
          setActiveChecked(true);
        }
      } else {
        setActiveChecked(true);
      }
    })();
  }, [pathname, router]);

  if (!allowed) return null;
  if (!pathname.includes("/pending") && !activeChecked) return null;

  // The pending page renders its own full-screen UI without the sidebar
  if (pathname.includes("/pending")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <DoctorSidebar userName={userName} />
      <div className="ml-[260px] flex-1 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
