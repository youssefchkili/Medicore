"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type Specialty = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

type Doctor = {
  id: string;
  bio: string | null;
  yearsExperience: number | null;
  consultationFee: string | null;
  isAvailable: boolean;
  rating: number | null;
  profile: { firstName: string; lastName: string; avatarUrl: string | null };
  specialty: { name: string; slug: string };
};

const GRADIENTS = [
  "linear-gradient(135deg,#60A5FA,#3B82F6)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#A78BFA,#7C3AED)",
  "linear-gradient(135deg,#FB923C,#F97316)",
  "linear-gradient(135deg,#F472B6,#EC4899)",
  "linear-gradient(135deg,#38BDF8,#0EA5E9)",
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? "#F59E0B" : "none"}
          stroke="#F59E0B" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="text-[12px] text-[#94A3B8] ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function BrowseDoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const requestSeq = useRef(0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    apiGet<Specialty[]>("/specialties").then(setSpecialties).catch(() => {});
  }, []);

  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSpecialty) params.set("specialty", selectedSpecialty);
    if (availableOnly) params.set("available", "true");
    const query = params.toString();
    apiGet<Doctor[]>(`/users/doctors${query ? `?${query}` : ""}`)
      .then((data) => {
        if (seq === requestSeq.current) setDoctors(data);
      })
      .catch((err: Error) => {
        if (seq === requestSeq.current) setError(err.message);
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [selectedSpecialty, availableOnly]);

  const filtered = search
    ? doctors.filter((d) =>
        `${d.profile.firstName} ${d.profile.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        d.specialty.name.toLowerCase().includes(search.toLowerCase())
      )
    : doctors;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">Browse Doctors</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {/* Filters */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-5 mb-6 flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or specialty…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[14px] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] focus:bg-white transition-all"
            />
          </div>

          {/* Specialty filter */}
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-[14px] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#374151]"
          >
            <option value="">All Specialties</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </select>

          {/* Available toggle */}
          <button
            onClick={() => setAvailableOnly((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading font-semibold text-[13px] transition-all"
            style={{
              background: availableOnly ? "#EFF6FF" : "#F8FAFC",
              color: availableOnly ? "#2563EB" : "#64748B",
              border: availableOnly ? "1.5px solid #BFDBFE" : "1px solid #E2E8F0",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: availableOnly ? "#10B981" : "#94A3B8" }}
            />
            Available Now
          </button>
        </div>

        {/* Specialties quick filter */}
        {specialties.length > 0 && (
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSpecialty("")}
              className="px-4 py-1.5 rounded-full font-heading font-semibold text-[12px] whitespace-nowrap transition-colors flex-shrink-0"
              style={{
                background: !selectedSpecialty ? "#2563EB" : "#F8FAFC",
                color: !selectedSpecialty ? "#fff" : "#64748B",
                border: !selectedSpecialty ? "none" : "1px solid #E2E8F0",
              }}
            >
              All
            </button>
            {specialties.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSpecialty(selectedSpecialty === s.slug ? "" : s.slug)}
                className="px-4 py-1.5 rounded-full font-heading font-semibold text-[12px] whitespace-nowrap transition-colors flex-shrink-0"
                style={{
                  background: selectedSpecialty === s.slug ? "#2563EB" : "#F8FAFC",
                  color: selectedSpecialty === s.slug ? "#fff" : "#64748B",
                  border: selectedSpecialty === s.slug ? "none" : "1px solid #E2E8F0",
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Count */}
        {!loading && (
          <p className="text-[13px] text-[#94A3B8] mb-4">
            {filtered.length} doctor{filtered.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
              <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="p-5 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <p className="font-heading font-semibold text-[16px] text-[#0F172A] mb-1">No doctors found</p>
            <p className="text-[14px] text-[#64748B]">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((doc, i) => {
              const fullName = `Dr. ${doc.profile.firstName} ${doc.profile.lastName}`;
              const initial = doc.profile.firstName.charAt(0);

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-[#E2E8F0] rounded-[20px] p-[22px] hover:-translate-y-0.5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-[16px] flex items-center justify-center font-bold text-[20px] text-white flex-shrink-0"
                      style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-heading font-bold text-[15px] text-[#0F172A]">{fullName}</p>
                          <p className="text-[13px] text-[#64748B]">{doc.specialty.name}</p>
                        </div>
                        <span
                          className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            color: doc.isAvailable ? "#059669" : "#94A3B8",
                            background: doc.isAvailable ? "#ECFDF5" : "#F1F5F9",
                          }}
                        >
                          {doc.isAvailable ? "Available" : "Unavailable"}
                        </span>
                      </div>
                      {doc.rating !== null && <StarRating rating={doc.rating} />}
                    </div>
                  </div>

                  {doc.bio && (
                    <p className="text-[13px] text-[#64748B] mb-4 line-clamp-2">{doc.bio}</p>
                  )}

                  <div className="flex items-center gap-3 mb-4 text-[12px] text-[#94A3B8]">
                    {doc.yearsExperience !== null && (
                      <span className="flex items-center gap-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {doc.yearsExperience} yrs exp.
                      </span>
                    )}
                    {doc.consultationFee && (
                      <span className="flex items-center gap-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                        </svg>
                        {doc.consultationFee} TND
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => router.push("/dashboard/patient/appointments")}
                    disabled={!doc.isAvailable}
                    className="w-full py-2.5 rounded-[12px] font-heading font-semibold text-[13px] text-white transition-all disabled:opacity-50 hover:shadow-md hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
                  >
                    {doc.isAvailable ? "Book Appointment" : "Not Available"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
