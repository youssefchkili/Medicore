"use client";

import { useState, useEffect, useRef } from "react";
import { apiGet, apiPatch, apiPostForm } from "@/lib/api";
import { createClient } from "@/lib/client";
import NotificationBell from "@/components/dashboard/NotificationBell";

type Specialty = { id: string; name: string; slug: string };

type DoctorProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  createdAt: string;
  doctor: {
    id: string;
    bio: string | null;
    yearsExperience: number | null;
    consultationFee: string | null;
    isAvailable: boolean;
    licenseNumber: string;
    faceRegistered: boolean;
    rating: number | null;
    specialty: { id: string; name: string; slug: string } | null;
  } | null;
};

const GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];
const GENDER_LABELS: Record<string, string> = {
  MALE: "Male", FEMALE: "Female", OTHER: "Other", PREFER_NOT_TO_SAY: "Prefer not to say",
};

const inputCls = "w-full px-4 py-2.5 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] focus:bg-white transition-all placeholder:text-[#94A3B8]";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-[8px] bg-[#F3F0FF] flex items-center justify-center">{icon}</div>
        <h2 className="font-heading font-bold text-[15px] text-[#0F172A]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block font-heading font-semibold text-[12px] text-[#64748B] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function EnrollModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBlobs, setPhotoBlobs] = useState<Blob[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setCameraReady(true));
        }
      })
      .catch(() => setError("Camera access denied. Please allow camera access in your browser."));
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || photos.length >= 3) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    canvas.toBlob((blob) => {
      if (blob) {
        setPhotoBlobs((p) => [...p, blob]);
        setPhotos((p) => [...p, url]);
      }
    }, "image/jpeg", 0.85);
  }

  async function handleEnroll() {
    if (photoBlobs.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      photoBlobs.forEach((b, i) => fd.append("photos", b, `photo_${i}.jpg`));
      await apiPostForm<{ enrolled: boolean }>("/ai-proxy/face/enroll", fd);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-[24px] w-full max-w-[420px] p-6" style={{ animation: "fadeInUp 0.25s ease both" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-heading font-bold text-[18px] text-[#0F172A]">Set Up Face Login</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">Take 1–3 photos for ArcFace enrollment</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Camera feed */}
        <div className="relative rounded-[16px] overflow-hidden bg-[#0F172A] mb-4" style={{ aspectRatio: "4/3" }}>
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {!cameraReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {/* Face outline guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-36 h-44 rounded-[50%] border-2 border-dashed border-white/40" />
          </div>
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white font-heading font-bold text-[12px] px-2.5 py-1 rounded-full">
            {photos.length} / 3
          </div>
        </div>

        {/* Captured thumbnails */}
        {photos.length > 0 && (
          <div className="flex gap-2 mb-4">
            {photos.map((url, i) => (
              <div key={i} className="w-16 h-16 rounded-[10px] overflow-hidden border-2 border-[#7C3AED] flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              </div>
            ))}
            {photos.length < 3 && (
              <div className="w-16 h-16 rounded-[10px] border-2 border-dashed border-[#E2E8F0] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-[10px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[13px]">{error}</div>
        )}

        <div className="flex gap-2">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() => { setPhotos([]); setPhotoBlobs([]); }}
              className="px-4 py-2.5 rounded-[12px] font-heading font-semibold text-[13px] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={capturePhoto}
            disabled={!cameraReady || photos.length >= 3}
            className="flex-1 py-2.5 rounded-[12px] font-heading font-semibold text-[13px] border border-[#7C3AED] text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {photos.length >= 3 ? "Max reached" : "Take Photo"}
          </button>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={photoBlobs.length === 0 || loading}
            className="flex-1 py-2.5 rounded-[12px] font-heading font-semibold text-[13px] text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}
          >
            {loading ? "Enrolling…" : "Enroll Face"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // Personal fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");

  // Doctor fields
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [hasDoctorRecord, setHasDoctorRecord] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    Promise.all([
      apiGet<DoctorProfile>("/users/me"),
      apiGet<Specialty[]>("/specialties"),
      createClient().auth.getUser(),
    ])
      .then(([p, s, { data: authData }]) => {
        setProfile(p);
        setSpecialties(s);
        setFirstName(p.firstName);
        setLastName(p.lastName);
        setPhone(p.phone ?? "");
        setDateOfBirth(p.dateOfBirth ? p.dateOfBirth.split("T")[0] : "");
        setGender(p.gender ?? "");
        // Read license_number from Supabase metadata (set at registration)
        const metaLicense = authData.user?.user_metadata?.license_number as string ?? "";
        if (p.doctor) {
          setHasDoctorRecord(true);
          setBio(p.doctor.bio ?? "");
          setYearsExperience(p.doctor.yearsExperience?.toString() ?? "");
          setConsultationFee(p.doctor.consultationFee ?? "");
          setSpecialtyId(p.doctor.specialty?.id ?? "");
          setIsAvailable(p.doctor.isAvailable);
          setLicenseNumber(p.doctor.licenseNumber);
          setFaceRegistered(p.doctor.faceRegistered);
        } else {
          setLicenseNumber(metaLicense);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    // Validate: specialty is required when creating the doctor record for the first time
    if (!hasDoctorRecord && !specialtyId) {
      setError("Please select your specialty before saving.");
      return;
    }
    if (!hasDoctorRecord && !licenseNumber) {
      setError("Your license number was not found. Please contact support.");
      return;
    }

    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      const profileBody: Record<string, unknown> = {};
      if (firstName) profileBody.firstName = firstName;
      if (lastName) profileBody.lastName = lastName;
      if (phone) profileBody.phone = phone;
      if (dateOfBirth) profileBody.dateOfBirth = dateOfBirth;
      if (gender) profileBody.gender = gender;
      await apiPatch("/users/me", profileBody);

      const doctorBody: Record<string, unknown> = {};
      // Always send licenseNumber so the backend can create the record if it doesn't exist
      doctorBody.licenseNumber = licenseNumber;
      if (bio) doctorBody.bio = bio;
      if (yearsExperience) doctorBody.yearsExperience = Number(yearsExperience);
      if (consultationFee) doctorBody.consultationFee = Number(consultationFee);
      if (specialtyId) doctorBody.specialtyId = specialtyId;
      doctorBody.isAvailable = isAvailable;
      await apiPatch("/users/me/doctor", doctorBody);

      setHasDoctorRecord(true);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSaving(false);
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
            {!hasDoctorRecord && !loading && (
              <div className="p-4 rounded-[14px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[14px]">
                Your professional profile has not been set up yet. Select a <strong>specialty</strong> and click <strong>Save Changes</strong> to complete your setup.
              </div>
            )}
            {error && (
              <div className="p-4 rounded-[14px] bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-[14px]">{error}</div>
            )}

            {/* Avatar */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-6 flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-[28px] text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}
              >
                {initial}
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-[18px] text-[#0F172A]">
                  Dr. {firstName} {lastName}
                </p>
                <p className="text-[14px] text-[#64748B]">
                  {profile?.doctor?.specialty?.name ?? "No specialty set"}
                </p>
                {profile && (
                  <p className="text-[12px] text-[#94A3B8] mt-0.5">
                    Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
              {/* Availability toggle */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAvailable(!isAvailable)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: isAvailable ? "#059669" : "#CBD5E1" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: isAvailable ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
                <span className="text-[11px] font-heading font-semibold" style={{ color: isAvailable ? "#059669" : "#94A3B8" }}>
                  {isAvailable ? "Available" : "Unavailable"}
                </span>
              </div>
            </div>

            {/* Personal info */}
            <Section title="Personal Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8">
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
                          background: gender === g ? "#7C3AED" : "#F8FAFC",
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

            {/* Doctor info */}
            <Section title="Professional Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            }>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Specialty" className="col-span-2">
                  <select
                    value={specialtyId}
                    onChange={(e) => setSpecialtyId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select a specialty…</option>
                    {specialties.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Years of Experience">
                  <input
                    type="number"
                    min="0"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="e.g. 5"
                    className={inputCls}
                  />
                </Field>
                <Field label="Consultation Fee (TND)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    placeholder="e.g. 60.00"
                    className={inputCls}
                  />
                </Field>
                {licenseNumber && (
                  <Field label="License Number" className="col-span-2">
                    <input value={licenseNumber} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
                  </Field>
                )}
                <Field label="Bio" className="col-span-2">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief description about your experience and approach…"
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </div>
            </Section>

            {/* Biometric Login */}
            <Section title="Biometric Login" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8">
                <path d="M12 3L4 7v5c0 4.6 3.5 8.9 8 10 4.5-1.1 8-5.4 8-10V7L12 3z" />
              </svg>
            }>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: faceRegistered ? "#ECFDF5" : "#F1F5F9" }}
                  >
                    {faceRegistered ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                        <path d="M12 3L4 7v5c0 4.6 3.5 8.9 8 10 4.5-1.1 8-5.4 8-10V7L12 3z" />
                        <path d="M9 12l2 2 4-4" strokeWidth="2.5" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8">
                        <circle cx="12" cy="10" r="3" />
                        <path d="M7 7C7 4.24 9.24 2 12 2s5 2.24 5 5" />
                        <path d="M5 12.5C5 9 8.13 6 12 6s7 3 7 6.5" />
                        <path d="M3 18c0-3.87 4.03-7 9-7s9 3.13 9 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-[14px]" style={{ color: faceRegistered ? "#059669" : "#0F172A" }}>
                      {faceRegistered ? "Face Login Active" : "Not Enrolled"}
                    </p>
                    <p className="text-[12px] text-[#64748B]">
                      {faceRegistered
                        ? "ArcFace recognition is set up for biometric login."
                        : "Register your face for faster, secure login."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(true)}
                  disabled={!hasDoctorRecord}
                  className="flex-shrink-0 px-4 py-2 rounded-[10px] font-heading font-semibold text-[13px] border border-[#7C3AED] text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {faceRegistered ? "Update Face" : "Set Up Face Login"}
                </button>
              </div>
              {!hasDoctorRecord && (
                <p className="text-[12px] text-[#94A3B8] mt-3">Save your professional profile first to enable biometric setup.</p>
              )}
            </Section>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 rounded-[16px] font-heading font-semibold text-[16px] text-white transition-all disabled:opacity-60 hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
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

      {showEnrollModal && (
        <EnrollModal
          onClose={() => setShowEnrollModal(false)}
          onSuccess={() => {
            setFaceRegistered(true);
            setShowEnrollModal(false);
          }}
        />
      )}
    </>
  );
}
