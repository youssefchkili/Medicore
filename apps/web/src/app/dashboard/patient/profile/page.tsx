"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type EmergencyContact = {
  name?: string;
  phone?: string;
  relation?: string;
};

type PatientProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  avatarUrl: string | null;
  createdAt: string;
  patient: {
    id: string;
    bloodType: string | null;
    allergies: string[];
    chronicConditions: string[];
    emergencyContact: EmergencyContact | null;
  } | null;
};

const BLOOD_TYPES = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "UNKNOWN"];
const BLOOD_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
  AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−", UNKNOWN: "Unknown",
};
const GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];
const GENDER_LABELS: Record<string, string> = {
  MALE: "Male", FEMALE: "Female", OTHER: "Other", PREFER_NOT_TO_SAY: "Prefer not to say",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");

  // Patient fields
  const [bloodType, setBloodType] = useState("");
  const [allergiesInput, setAllergiesInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [chronicInput, setChronicInput] = useState("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    apiGet<PatientProfile>("/users/me")
      .then((data) => {
        setProfile(data);
        setFirstName(data.firstName);
        setLastName(data.lastName);
        setPhone(data.phone ?? "");
        setDateOfBirth(data.dateOfBirth ? data.dateOfBirth.split("T")[0] : "");
        setGender(data.gender ?? "");
        if (data.patient) {
          setBloodType(data.patient.bloodType ?? "");
          setAllergies(data.patient.allergies ?? []);
          setChronicConditions(data.patient.chronicConditions ?? []);
          const ec = data.patient.emergencyContact ?? {};
          setEmergencyName(ec.name ?? "");
          setEmergencyPhone(ec.phone ?? "");
          setEmergencyRelation(ec.relation ?? "");
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    const profileBody: Record<string, unknown> = {};
    if (firstName) profileBody.firstName = firstName;
    if (lastName) profileBody.lastName = lastName;
    if (phone) profileBody.phone = phone;
    if (dateOfBirth) profileBody.dateOfBirth = dateOfBirth;
    if (gender) profileBody.gender = gender;

    try {
      await apiPatch("/users/me", profileBody);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Failed to save personal information.");
      return;
    }

    const patientBody: Record<string, unknown> = {};
    if (bloodType) patientBody.bloodType = bloodType;
    patientBody.allergies = allergies;
    patientBody.chronicConditions = chronicConditions;
    if (emergencyName || emergencyPhone || emergencyRelation) {
      patientBody.emergencyContact = {
        name: emergencyName,
        phone: emergencyPhone,
        relation: emergencyRelation,
      };
    }

    try {
      await apiPatch("/users/me/patient", patientBody);
    } catch (err) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : "Failed to save health information.";
      setError(`${msg} Your personal information was saved, but health details were not — please try saving again.`);
      return;
    }

    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  function addAllergy() {
    const val = allergiesInput.trim();
    if (val && !allergies.includes(val)) {
      setAllergies((prev) => [...prev, val]);
      setAllergiesInput("");
    }
  }

  function addChronic() {
    const val = chronicInput.trim();
    if (val && !chronicConditions.includes(val)) {
      setChronicConditions((prev) => [...prev, val]);
      setChronicInput("");
    }
  }

  const initial = (firstName || profile?.firstName || "?").charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">My Profile</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#059669]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Saved!
            </span>
          )}
          <NotificationBell />
        </div>
      </header>

      <main className="p-7 flex-1" style={{ animation: "fadeIn 0.4s ease both" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
              <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            {error && (
              <div className="p-4 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
            )}

            {/* Avatar section */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-6 flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-[28px] text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
              >
                {initial}
              </div>
              <div>
                <p className="font-heading font-bold text-[18px] text-[#0F172A]">
                  {firstName} {lastName}
                </p>
                <p className="text-[14px] text-[#64748B]">Patient</p>
                {profile && (
                  <p className="text-[12px] text-[#94A3B8] mt-0.5">
                    Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            </div>

            {/* Personal info */}
            <Section title="Personal Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
              </svg>
            }>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Last Name">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Phone Number">
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 XX XXX XXX" className={inputCls} />
                </Field>
                <Field label="Date of Birth">
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Gender" className="col-span-2">
                  <div className="flex gap-2 flex-wrap">
                    {GENDERS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className="px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] transition-all"
                        style={{
                          background: gender === g ? "#2563EB" : "#F8FAFC",
                          color: gender === g ? "#fff" : "#64748B",
                          border: gender === g ? "none" : "1px solid #E2E8F0",
                        }}
                      >
                        {GENDER_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            {/* Health info */}
            <Section title="Health Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            }>
              <div className="flex flex-col gap-4">
                {/* Blood type */}
                <Field label="Blood Type">
                  <div className="flex gap-2 flex-wrap">
                    {BLOOD_TYPES.map((bt) => (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setBloodType(bt)}
                        className="px-3.5 py-2 rounded-[10px] font-heading font-semibold text-[13px] transition-all"
                        style={{
                          background: bloodType === bt ? "#EF4444" : "#F8FAFC",
                          color: bloodType === bt ? "#fff" : "#64748B",
                          border: bloodType === bt ? "none" : "1px solid #E2E8F0",
                        }}
                      >
                        {BLOOD_LABELS[bt]}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Allergies */}
                <Field label="Allergies">
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {allergies.map((a) => (
                      <span key={a} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#FEF9C3] border border-[#FDE047] text-[#854D0E] text-[12px] font-medium">
                        {a}
                        <button onClick={() => setAllergies((prev) => prev.filter((x) => x !== a))} className="ml-0.5 text-[#854D0E] hover:text-[#92400E]">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={allergiesInput}
                      onChange={(e) => setAllergiesInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAllergy(); } }}
                      placeholder="Add allergy (press Enter)…"
                      className={`${inputCls} flex-1`}
                    />
                    <button onClick={addAllergy} className="px-3 py-2.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] hover:text-[#2563EB] transition-all text-[13px] font-medium">
                      Add
                    </button>
                  </div>
                </Field>

                {/* Chronic conditions */}
                <Field label="Chronic Conditions">
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {chronicConditions.map((c) => (
                      <span key={c} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#FEF2F2] border border-[#FECDD3] text-[#9F1239] text-[12px] font-medium">
                        {c}
                        <button onClick={() => setChronicConditions((prev) => prev.filter((x) => x !== c))} className="ml-0.5 hover:text-[#BE123C]">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chronicInput}
                      onChange={(e) => setChronicInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChronic(); } }}
                      placeholder="Add condition (press Enter)…"
                      className={`${inputCls} flex-1`}
                    />
                    <button onClick={addChronic} className="px-3 py-2.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] hover:text-[#2563EB] transition-all text-[13px] font-medium">
                      Add
                    </button>
                  </div>
                </Field>
              </div>
            </Section>

            {/* Emergency contact */}
            <Section title="Emergency Contact" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 01.13 2.82 2 2 0 012.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.61-.45a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
            }>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact Name">
                  <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Full name" className={inputCls} />
                </Field>
                <Field label="Phone Number">
                  <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+216 XX XXX XXX" className={inputCls} />
                </Field>
                <Field label="Relationship" className="col-span-2">
                  <input value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)} placeholder="e.g. Parent, Spouse, Sibling…" className={inputCls} />
                </Field>
              </div>
            </Section>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 rounded-[16px] font-heading font-semibold text-[16px] text-white transition-all disabled:opacity-60 hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : "Save Changes"}
            </button>
          </div>
        )}
      </main>
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full px-4 py-2.5 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] focus:bg-white transition-all placeholder:text-[#94A3B8]";

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-[8px] bg-[#EFF6FF] flex items-center justify-center">{icon}</div>
        <h2 className="font-heading font-bold text-[15px] text-[#0F172A]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block font-heading font-semibold text-[12px] text-[#64748B] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
