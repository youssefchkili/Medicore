# MediCore — Full Project Context for UI Design

## What This Document Is

This file gives a complete picture of the MediCore platform so a design agent can generate every page, layout, and component without looking at any code. It covers the product purpose, all three user roles, every API endpoint, all data shapes, and every user flow from first visit to task completion.

---

## 1. Product Overview

**MediCore** is an AI-assisted telemedicine platform for Tunisia. Patients describe their symptoms to an AI chatbot that produces a structured pre-diagnostic report. A doctor reviews the report, confirms an appointment, then conducts a live video consultation. The platform has three user types: **Patient**, **Doctor**, and **Admin**.

### Core Value Propositions
- Patients get an AI pre-screening before seeing a real doctor, reducing wasted appointments.
- Doctors receive a structured symptom report before the consultation, saving time.
- The AI detects the doctor's emotions during a session (stress, fatigue) and logs them privately for wellness tracking.
- Doctors log in with face recognition (biometric 2FA) for secure access.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, TypeScript |
| Backend API | NestJS 11 (Fastify adapter), TypeScript, Prisma ORM |
| AI Service | FastAPI (Python), LangGraph multi-agent, Groq LLM |
| Database | PostgreSQL via Supabase (shared between backend and AI service) |
| Auth | Supabase Auth (email/password) + ArcFace biometric 2FA for doctors |
| Vector DB | Qdrant (medical knowledge base for RAG) |
| Email | Resend |
| Frontend URL | `http://localhost:3000` |
| Backend URL | `http://localhost:3001` |
| AI Service URL | `http://localhost:8000` |

---

## 3. User Roles

### PATIENT
- Registers with email/password via Supabase Auth.
- Fills a health profile (blood type, allergies, chronic conditions, emergency contact, insurance).
- Starts an AI chat session to describe symptoms → receives a pre-diagnostic report.
- Books appointments with doctors, optionally attaching a pre-diagnostic.
- Receives in-app notifications (diagnostic ready, appointment confirmed, session started).
- Views their medical records and past diagnostics (read-only).

### DOCTOR
- Registers with email/password, must be **approved by an Admin** before they can access the platform.
- Enrolls their face (uploads 1–5 photos) for biometric 2FA.
- On every login: email/password first → then face verification photo.
- Manages their availability slots (creates/deletes time slots patients can book).
- Views upcoming appointments and attached pre-diagnostic reports.
- Creates a **Session** when a consultation starts, runs the emotion detection stream from their webcam.
- Reviews AI diagnostics and adds doctor notes.
- Creates medical records with SOAP notes (Subjective, Objective, Assessment, Plan).

### ADMIN
- Approves or deactivates doctor accounts.
- Views platform statistics (user counts, appointment counts, diagnostic counts).
- Triggers a re-scrape of MedlinePlus + PubMed to refresh the AI knowledge base.
- Views audit logs.
- Manages medical specialties (create, update, soft-delete).

---

## 4. Database Models (Prisma Schema)

### Enums
```
Role:              PATIENT | DOCTOR | ADMIN
Gender:            MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY
BloodType:         A_POS | A_NEG | B_POS | B_NEG | AB_POS | AB_NEG | O_POS | O_NEG | UNKNOWN
Urgency:           LOW | MEDIUM | HIGH | EMERGENCY
DiagnosticStatus:  PENDING_REVIEW | REVIEWED | ARCHIVED
AppointmentType:   ONLINE | IN_PERSON
AppointmentStatus: SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW
SessionStatus:     WAITING | ACTIVE | ENDED
ChatStatus:        ACTIVE | COMPLETED | ABANDONED
MessageRole:       USER | ASSISTANT | SYSTEM
NotificationType:  APPOINTMENT_CONFIRMED | APPOINTMENT_REMINDER | APPOINTMENT_CANCELLED |
                   DIAGNOSTIC_READY | SESSION_STARTED | SYSTEM
```

### Profile
Extension of Supabase auth user. Created on first login via `POST /auth/sync-profile`.
```
id            UUID (= Supabase auth.uid)
role          Role
firstName     String
lastName      String
phone         String?
dateOfBirth   Date?
gender        Gender?
avatarUrl     String?
isActive      Boolean
createdAt     DateTime
updatedAt     DateTime
→ doctor      Doctor?
→ patient     Patient?
```

### Doctor
```
id               UUID
profileId        UUID → Profile
specialtyId      UUID → Specialty
licenseNumber    String (unique)
bio              String?
yearsExperience  Int?
consultationFee  Decimal?
isAvailable      Boolean
rating           Float?
faceRegistered   Boolean   ← true after face enrollment
createdAt        DateTime
→ availabilitySlots  AvailabilitySlot[]
→ appointments       Appointment[]
→ sessions           Session[]
→ medicalRecords     MedicalRecord[]
→ reviewedDiagnostics PreDiagnostic[]
→ faceEmbedding      FaceEmbedding?
→ biometricLogs      BiometricLoginLog[]
```

### Patient
```
id                UUID
profileId         UUID → Profile
bloodType         BloodType?
allergies         String[]
chronicConditions String[]
emergencyContact  Json?   { name, phone, relationship }
insuranceInfo     Json?   { provider, policyNumber }
createdAt         DateTime
→ chatSessions    ChatSession[]
→ preDiagnostics  PreDiagnostic[]
→ appointments    Appointment[]
→ sessions        Session[]
→ medicalRecords  MedicalRecord[]
```

### Specialty
```
id          UUID
name        String (unique)
slug        String (unique)
description String?
icon        String?
isActive    Boolean
→ doctors   Doctor[]
```

### AvailabilitySlot
```
id             UUID
doctorId       UUID → Doctor
startTime      DateTime
endTime        DateTime
isBooked       Boolean
isRecurring    Boolean
recurrenceRule String?
createdAt      DateTime
→ appointment  Appointment?
```

### Appointment
```
id              UUID
patientId       UUID → Patient
doctorId        UUID → Doctor
preDiagnosticId UUID? → PreDiagnostic
slotId          UUID → AvailabilitySlot (unique)
scheduledAt     DateTime
durationMinutes Int (default 30)
type            AppointmentType
status          AppointmentStatus
notes           String?
videoRoomUrl    String?
cancelledReason String?
createdAt       DateTime
updatedAt       DateTime
→ session       Session?
```

### ChatSession
```
id                UUID
patientId         UUID → Patient
langgraphThreadId String (unique)
status            ChatStatus
agentState        Json?    ← full LangGraph state persisted here
tokenCount        Int
startedAt         DateTime
endedAt           DateTime?
→ messages        ChatMessage[]
→ preDiagnostic   PreDiagnostic?
→ agentInvocations AgentInvocation[]
```

### ChatMessage
```
id        UUID
sessionId UUID → ChatSession
role      MessageRole  (USER | ASSISTANT | SYSTEM)
content   String
agentName String?      ← which AI agent produced this message
metadata  Json?
createdAt DateTime
```

### PreDiagnostic
```
id                UUID
patientId         UUID → Patient
chatSessionId     UUID → ChatSession (unique)
symptoms          Json    { symptom_name: { duration, severity, ... } }
severityLevel     Int (1–10)
urgency           Urgency
suggestedSpecialty String?
possibleConditions Json[]  [ { name, confidence: "low"|"medium"|"high", description } ]
ragSources        Json[]  [ { url, title, section } ]
rawReport         String   (JSON string of full FinalReport)
status            DiagnosticStatus
reviewedBy        UUID? → Doctor
doctorNotes       String?
createdAt         DateTime
updatedAt         DateTime
→ appointments    Appointment[]
```

### Session  (doctor-patient video consultation)
```
id              UUID
appointmentId   UUID → Appointment (unique)
doctorId        UUID → Doctor
patientId       UUID → Patient
startedAt       DateTime?
endedAt         DateTime?
soapSummary     Json?   { subjective, objective, assessment, plan }
emotionTimeline Json?
recordingUrl    String?
status          SessionStatus
→ emotionSnapshots EmotionSnapshot[]
→ medicalRecord    MedicalRecord?
```

### MedicalRecord
```
id             UUID
patientId      UUID → Patient
sessionId      UUID? → Session (unique)
doctorId       UUID → Doctor
soapNotes      Json   { subjective, objective, assessment, plan }
diagnosis      String?
prescription   Json?
attachments    String[]
isConfidential Boolean
createdAt      DateTime
```

### EmotionSnapshot  (doctor-only, never shown to patient)
```
id              UUID
sessionId       UUID → Session
timestamp       DateTime
dominantEmotion String
happy           Float
sad             Float
fearful         Float
angry           Float
surprised       Float
disgusted       Float
neutral         Float
confidence      Float
```

### Notification
```
id           UUID
recipientId  UUID → Profile
type         NotificationType
title        String
body         String
data         Json?   { preDiagnosticId?, sessionId?, appointmentId? }
isRead       Boolean
sentViaEmail Boolean
createdAt    DateTime
```

### FaceEmbedding
```
id             UUID
doctorId       UUID → Doctor (unique)
embedding      Float[]   (512-dim ArcFace vector)
modelUsed      String
antiSpoofScore Float?
enrolledAt     DateTime
updatedAt      DateTime
```

### BiometricLoginLog
```
id              UUID
doctorId        UUID → Doctor
success         Boolean
similarityScore Float
antiSpoofPass   Boolean
ipAddress       String?
userAgent       String?
attemptedAt     DateTime
```

### AgentInvocation
```
id            UUID
chatSessionId UUID → ChatSession
agentName     String   (triage | symptom_collector | clarification | rag_agent | report_agent)
input         Json
output        Json?
tokensUsed    Int
latencyMs     Int?
error         String?
createdAt     DateTime
```

---

## 5. NestJS API Endpoints (Base URL: /api or http://localhost:3001)

### Auth
```
POST /auth/sync-profile
  Guard: JwtVerifyGuard (JWT must be valid but profile need not exist yet)
  Body: { firstName, lastName, role: "PATIENT"|"DOCTOR"|"ADMIN" }
  Returns: Profile
  Purpose: Called immediately after Supabase signup to create the profile row.
```

### Users
```
GET  /users/me
  Guard: JwtAuthGuard
  Returns: Profile with doctor/patient sub-record

PATCH /users/me
  Guard: JwtAuthGuard
  Body: { firstName?, lastName?, phone?, dateOfBirth?, gender?, avatarUrl? }
  Returns: updated Profile

PATCH /users/me/patient
  Guard: JwtAuthGuard + PATIENT role
  Body: { bloodType?, allergies?, chronicConditions?, emergencyContact?, insuranceInfo? }
  Returns: updated Patient

PATCH /users/me/doctor
  Guard: JwtAuthGuard + DOCTOR role
  Body: { specialtyId?, bio?, yearsExperience?, consultationFee?, isAvailable? }
  Returns: updated Doctor

POST /users/me/patient/init
  Guard: JwtAuthGuard + PATIENT role
  Returns: Patient (creates the Patient record if missing)

GET /users/doctors?specialty=<slug>&available=true
  Public
  Returns: Doctor[] with profile and specialty

GET /users/doctors/:id
  Public
  Returns: Doctor with profile, specialty, and next 20 available slots
```

### Specialties
```
GET  /specialties?all=true
  Returns: Specialty[] (all=true shows inactive ones, admin only)

GET  /specialties/:slug
  Returns: Specialty with its active doctors

POST /specialties
  Guard: JwtAuthGuard + ADMIN
  Body: { name, slug, description?, icon? }

PATCH /specialties/:id
  Guard: JwtAuthGuard + ADMIN
  Body: { name?, slug?, description?, icon? }

DELETE /specialties/:id
  Guard: JwtAuthGuard + ADMIN
  Soft-deletes (sets isActive=false)
```

### Appointments & Availability
```
GET  /availability/:doctorId
  Returns: AvailabilitySlot[] (unbooked, future)

POST /availability
  Guard: JwtAuthGuard + DOCTOR
  Body: { startTime, endTime, isRecurring?, recurrenceRule? }
  Returns: AvailabilitySlot

DELETE /availability/:id
  Guard: JwtAuthGuard + DOCTOR
  Deletes slot (must be unbooked)

GET  /appointments
  Guard: JwtAuthGuard
  Returns: Appointment[] for the current user (patient sees their own, doctor sees their own)

GET  /appointments/:id
  Guard: JwtAuthGuard
  Returns: single Appointment (access-controlled)

POST /appointments
  Guard: JwtAuthGuard + PATIENT
  Body: { doctorId, slotId, preDiagnosticId?, type?, durationMinutes?, notes? }
  Returns: Appointment (transactional booking, prevents double-booking)

PATCH /appointments/:id/cancel
  Guard: JwtAuthGuard
  Body: { reason? }
  Returns: cancelled Appointment (also un-books the slot)

PATCH /appointments/:id/confirm
  Guard: JwtAuthGuard + DOCTOR
  Returns: confirmed Appointment
```

### Sessions (Doctor-Patient Video Consultations)
```
GET  /sessions
  Guard: JwtAuthGuard
  Returns: last 20 Sessions for the current user

GET  /sessions/:id
  Guard: JwtAuthGuard
  Returns: Session with emotionSnapshots (snapshots stripped for patients) and medicalRecord

POST /sessions
  Guard: JwtAuthGuard + DOCTOR
  Body: { appointmentId }
  Returns: Session  ← session.id is used for the emotion WebSocket

PATCH /sessions/:id/start
  Guard: JwtAuthGuard + DOCTOR
  Returns: Session (sets startedAt, status=ACTIVE, notifies patient)

PATCH /sessions/:id/end
  Guard: JwtAuthGuard + DOCTOR
  Body: { soapSummary?, recordingUrl? }
  Returns: Session with emotionSnapshots (status=ENDED, sets endedAt)
```

### Medical Records
```
GET  /medical-records
  Guard: JwtAuthGuard
  Returns: MedicalRecord[] (patients see non-confidential, doctors see their own)

GET  /medical-records/:id
  Guard: JwtAuthGuard
  Returns: single MedicalRecord (access-controlled)

POST /medical-records
  Guard: JwtAuthGuard + DOCTOR
  Body: { patientId, sessionId?, soapNotes: {subjective,objective,assessment,plan},
          diagnosis?, prescription?, attachments?, isConfidential? }
  Returns: MedicalRecord

GET  /diagnostics
  Guard: JwtAuthGuard
  Returns: PreDiagnostic[] (patient sees own, doctor sees ones they reviewed)

GET  /diagnostics/:id
  Guard: JwtAuthGuard
  Returns: single PreDiagnostic (patient owner, reviewer doctor, or admin)

PATCH /diagnostics/:id/review
  Guard: JwtAuthGuard + DOCTOR
  Body: { status: "REVIEWED"|"ARCHIVED", doctorNotes: string }
  Returns: reviewed PreDiagnostic
```

### Notifications
```
GET  /notifications?unread=true
  Guard: JwtAuthGuard
  Returns: last 50 Notification[] for the current user

PATCH /notifications/:id/read
  Guard: JwtAuthGuard
  Returns: Notification (isRead=true)

PATCH /notifications/read-all
  Guard: JwtAuthGuard
  Marks all notifications as read
```

### AI Proxy
```
POST /ai-proxy/chat/start
  Guard: JwtAuthGuard + PATIENT
  Returns: { chatSessionId, langgraphThreadId, wsPath: "/ai/chat/<chatSessionId>" }
  Purpose: Patient calls this before opening the AI chat WebSocket.

POST /ai-proxy/face/enroll
  Guard: JwtAuthGuard + DOCTOR
  Body: multipart/form-data  { photos: File[] (1-5 JPEG/PNG) }
  Returns: { enrolled: true, photosUsed: number }
  Purpose: Doctor uploads enrollment photos. Sets Doctor.faceRegistered=true.

POST /ai-proxy/face/verify
  Guard: JwtAuthGuard + DOCTOR
  Body: multipart/form-data  { photo: File }
  Returns: { success: bool, similarityScore: float, antiSpoofPass: bool }
  Purpose: Face 2FA check after JWT login.

POST /ai-proxy/scraper/refresh
  Guard: JwtAuthGuard + ADMIN
  Body: { terms?: string[] }
  Returns: { message, termsQueued }
  Purpose: Triggers re-scrape of MedlinePlus + PubMed.
```

### Admin
```
GET  /admin/stats
  Guard: JwtAuthGuard + ADMIN
  Returns: { patients, doctors, appointments, diagnostics }  (counts)

GET  /admin/users?role=DOCTOR
  Guard: JwtAuthGuard + ADMIN
  Returns: Profile[] (all or filtered by role)

PATCH /admin/users/:id/toggle
  Guard: JwtAuthGuard + ADMIN
  Returns: Profile (toggles isActive)

POST /admin/doctors/approve/:profileId
  Guard: JwtAuthGuard + ADMIN
  Returns: Profile (approves doctor signup — sets isActive=true)

GET  /admin/audit-logs?limit=50
  Guard: JwtAuthGuard + ADMIN
  Returns: AuditLog[]
```

---

## 6. AI Service WebSocket & REST (Base URL: http://localhost:8000)

### AI Chat WebSocket
```
WS  /chat/{chatSessionId}
  Protocol (JSON):
    Client → Server:  { "message": "I have a headache and fever" }
    Server → Client:  { "type": "message", "agent": "triage"|"symptom_collector"|..., "content": "..." }
                      { "type": "complete" }   ← pre-diagnostic is ready
                      { "type": "error", "message": "..." }

  Flow:
    1. Patient opens WebSocket after calling POST /ai-proxy/chat/start
    2. Sends messages describing symptoms
    3. AI agents stream responses:
       - triage: assesses urgency (LOW/MEDIUM/HIGH/EMERGENCY)
       - symptom_collector: asks follow-up questions
       - clarification: resolves vague answers
       - rag_agent: retrieves medical knowledge
       - report_agent: generates final pre-diagnostic
    4. On "complete": pre-diagnostic is saved, doctor is notified
```

### Emotion Detection WebSocket
```
WS  /emotion/stream/{sessionId}
  Purpose: Doctor's browser streams webcam frames during a consultation.
           Server responds with emotion scores after each frame.
           Data is never shown to the patient.

  sessionId: the Session.id returned from POST /sessions

  Client → Server:  { "frame": "<base64-encoded JPEG>" }
  Server → Client:  { "type": "emotion", "data": {
                        dominant_emotion: string,
                        scores: { happy, sad, fearful, angry, surprised, disgusted, neutral },
                        confidence: float
                      }, "timestamp": "ISO-8601" }
                    { "type": "ping" }   ← keepalive every 30s
```

### AI Service REST (internal, called by NestJS admin — not from frontend directly)
```
GET  /health                        → { status: "ok" }
GET  /diagnostics/status/:sessionId → diagnostic completion check
POST /scraper/refresh               → re-scrape trigger
GET  /scraper/status                → { chunksIndexed: number }
POST /face/enroll                   → (proxied via NestJS /ai-proxy/face/enroll)
POST /face/verify                   → (proxied via NestJS /ai-proxy/face/verify)
```

---

## 7. Complete User Flows

### 7.1 Patient Registration & Onboarding
```
1. /register → Supabase email/password signup
2. POST /auth/sync-profile  { firstName, lastName, role: "PATIENT" }
3. POST /users/me/patient/init  (creates Patient record)
4. /onboarding → PATCH /users/me/patient  (fill blood type, allergies, etc.)
5. Redirect to patient dashboard
```

### 7.2 Patient: AI Pre-Diagnostic Chat
```
1. Patient clicks "Start Pre-Screening"
2. POST /ai-proxy/chat/start → gets { chatSessionId, wsPath }
3. Frontend opens WebSocket to ws://localhost:8000/chat/{chatSessionId}
4. Patient types symptoms → server streams AI responses
5. Agents ask follow-up questions (patient keeps responding)
6. When "complete" arrives: WebSocket closes, patient sees "Report Ready"
7. Patient gets a DIAGNOSTIC_READY in-app notification
8. Patient views their diagnostic at /diagnostics/{preDiagnosticId}
```

### 7.3 Patient: Booking an Appointment
```
1. Browse doctors: GET /users/doctors?specialty=cardiology&available=true
2. View a doctor: GET /users/doctors/:id  (shows available slots)
3. Click a slot → POST /appointments  { doctorId, slotId, preDiagnosticId?, type }
4. Appointment appears in patient dashboard
5. Doctor confirms → patient gets APPOINTMENT_CONFIRMED notification
```

### 7.4 Doctor Registration & Approval
```
1. /register → Supabase signup
2. POST /auth/sync-profile  { firstName, lastName, role: "DOCTOR" }
3. Doctor fills profile: PATCH /users/me/doctor  { specialtyId, licenseNumber, bio, ... }
4. Account is INACTIVE until admin approves
5. Admin calls POST /admin/doctors/approve/:profileId → isActive=true
6. Doctor can now log in fully
```

### 7.5 Doctor: Face Enrollment (one-time setup)
```
1. Doctor goes to /settings/biometrics
2. Camera UI captures 1–5 photos
3. POST /ai-proxy/face/enroll  (multipart, field name: "photos")
4. On success: Doctor.faceRegistered=true, UI shows "Face enrolled"
```

### 7.6 Doctor: Login with Face 2FA
```
1. /login → email/password → Supabase issues JWT
2. If doctor.faceRegistered=true → redirect to /login/face-verify
3. Camera captures live photo
4. POST /ai-proxy/face/verify  (multipart, field name: "photo")
5. If result.success=true → proceed to doctor dashboard
6. If false → show error, allow retry
```

### 7.7 Doctor: Running a Consultation
```
1. Doctor views appointment: GET /appointments/:id
2. Click "Start Session" → POST /sessions  { appointmentId }
   → returns Session with id
3. PATCH /sessions/{sessionId}/start
   → patient gets SESSION_STARTED notification
4. Doctor's browser opens emotion WebSocket:
   ws://localhost:8000/emotion/stream/{sessionId}
   → starts streaming webcam frames, receives emotion scores
5. Doctor conducts video call (video room URL from appointment.videoRoomUrl)
6. After call: PATCH /sessions/{sessionId}/end  { soapSummary, recordingUrl? }
7. POST /medical-records  { patientId, sessionId, soapNotes, diagnosis, prescription }
8. PATCH /diagnostics/{preDiagnosticId}/review  { status: "REVIEWED", doctorNotes }
```

### 7.8 Admin Dashboard
```
1. GET /admin/stats → display counters
2. GET /admin/users?role=DOCTOR → list pending doctors
3. POST /admin/doctors/approve/:profileId → approve
4. PATCH /admin/users/:id/toggle → deactivate/reactivate
5. POST /ai-proxy/scraper/refresh → trigger knowledge base update
6. GET /admin/audit-logs → view activity
```

---

## 8. Frontend Architecture

### Route Structure (App Router)

```
/                          Landing page (public)
/login                     Email/password login
/login/face-verify         Doctor face 2FA step
/register                  Role selection + signup
/onboarding                Profile completion after signup

/(patient)/
  dashboard                Overview: diagnostics, upcoming appointments, notifications
  chat                     AI pre-diagnostic chat interface
  chat/[sessionId]         Active chat session (WebSocket)
  diagnostics              List of pre-diagnostic reports
  diagnostics/[id]         Single diagnostic report
  appointments             Upcoming and past appointments
  appointments/[id]        Appointment detail
  doctors                  Browse doctors
  doctors/[id]             Doctor profile + booking
  profile                  Patient profile settings

/(doctor)/
  dashboard                Overview: upcoming appointments, pending reviews
  appointments             Appointment list
  appointments/[id]        Appointment detail + start session
  sessions/[id]            Active session (emotion stream + video)
  diagnostics              Diagnostics pending review
  diagnostics/[id]         Review and annotate diagnostic
  patients/[id]            Patient history and records
  availability             Manage time slots
  profile                  Doctor profile settings
  settings/biometrics      Face enrollment UI

/(admin)/
  dashboard                Stats, charts
  users                    User list with role filter
  users/[id]               User detail + approve/toggle
  specialties              Specialty management
  knowledge-base           Scraper status + trigger refresh
  audit-logs               Activity log

/notifications             Notification center (all roles)
```

### Supabase Auth Integration
- Use `@supabase/ssr` (already installed) for server-side auth.
- `lib/client.ts` exports `createClient()` for browser components.
- `lib/server.ts` exports `createClient()` for Server Components and Route Handlers.
- `lib/middleware.ts` handles session refresh on every request.
- After Supabase login, immediately call `POST /auth/sync-profile` to ensure the NestJS profile exists.
- Store the JWT from Supabase session; pass it as `Authorization: Bearer <token>` to all NestJS calls.

### Environment Variables (frontend)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_WS_URL=ws://localhost:8000
```

---

## 9. Key UI Components Needed

### Shared
- `Navbar` — role-aware navigation (different links for patient/doctor/admin)
- `NotificationBell` — polls `/notifications?unread=true`, shows badge, dropdown
- `AvatarUpload` — profile photo upload
- `RoleBadge` — colored pill for PATIENT/DOCTOR/ADMIN
- `UrgencyBadge` — colored pill: LOW=green, MEDIUM=yellow, HIGH=orange, EMERGENCY=red

### Patient-specific
- `ChatInterface` — WebSocket chat UI with streaming messages, typing indicator, agent label per message
- `DiagnosticCard` — shows urgency badge, suggested specialty, symptoms summary, possible conditions
- `DoctorCard` — photo, name, specialty, rating, fee, available slots
- `SlotPicker` — calendar/time grid showing available slots
- `AppointmentCard` — status badge, doctor info, date/time, actions (cancel, view)

### Doctor-specific
- `FaceEnrollCamera` — webcam capture, multi-photo grid, submit button
- `FaceVerifyCamera` — live webcam capture, verify button, result overlay
- `EmotionStream` — hidden webcam + WebSocket, live emotion bar chart (doctor sees it, patient doesn't)
- `SOAPEditor` — four text areas: Subjective, Objective, Assessment, Plan
- `DiagnosticReview` — read-only diagnostic + doctor notes text area + status select
- `AvailabilityCalendar` — weekly view, click to add/remove slots
- `SessionControls` — start/end session buttons, timer, session status

### Admin-specific
- `StatsGrid` — four metric cards (patients, doctors, appointments, diagnostics)
- `UserTable` — sortable table with approve/toggle actions
- `AuditLogTable` — timestamp, actor, action, resource
- `ScraperPanel` — status (chunks indexed), refresh button, last-run timestamp

---

## 10. Design System Suggestions

### Brand Identity
- **Name:** MediCore
- **Tagline:** "AI-powered care, human expertise"
- **Tone:** Professional, trustworthy, calm — not cold or clinical

### Color Palette
```
Primary:      #2563EB  (blue-600)   — trust, medicine, technology
Primary dark: #1D4ED8  (blue-700)
Accent:       #10B981  (emerald-500) — health, success, positive results
Warning:      #F59E0B  (amber-500)  — medium urgency
Danger:       #EF4444  (red-500)    — high urgency, emergency, errors
Background:   #F8FAFC  (slate-50)   — light mode default
Surface:      #FFFFFF
Border:       #E2E8F0  (slate-200)
Text primary: #0F172A  (slate-900)
Text muted:   #64748B  (slate-500)
```

### Urgency Color Map (used everywhere urgency is shown)
```
LOW       → emerald-500  bg-emerald-50 text-emerald-700
MEDIUM    → amber-500    bg-amber-50   text-amber-700
HIGH      → orange-500   bg-orange-50  text-orange-700
EMERGENCY → red-600      bg-red-50     text-red-700  (+ pulsing animation)
```

### Typography
- Font: Inter (system-ui fallback)
- Headings: font-semibold, tight tracking
- Body: font-normal, relaxed leading

### Component Style
- Rounded corners: `rounded-xl` for cards, `rounded-lg` for inputs/buttons
- Shadows: subtle `shadow-sm` on cards, `shadow-md` on modals
- Use shadcn/ui components as the base (already installed via `components.json`)
- Sidebar layout for authenticated pages (not top-nav)
- Dark mode support via Tailwind dark: variants

### Layout Patterns
- **Authenticated layout:** Fixed left sidebar (240px) + main content area
- **Sidebar sections:**
  - Patient: Dashboard, Chat, Diagnostics, Appointments, Doctors, Profile
  - Doctor: Dashboard, Appointments, Diagnostics, Availability, Sessions, Profile, Biometrics
  - Admin: Dashboard, Users, Specialties, Knowledge Base, Audit Logs
- **Dashboard cards:** 2-column grid on desktop, 1-column on mobile
- **Tables:** Striped, hoverable rows, pagination at bottom
- **Forms:** Two-column on desktop, single-column on mobile, floating labels or standard labeled inputs

---

## 11. AI Chat UI Specification

The chat is the most important patient-facing feature. Design it carefully.

```
Layout:
- Full-height panel, no page scroll (chat scrolls internally)
- Message bubbles: patient right-aligned (blue), AI left-aligned (white/gray)
- Each AI message shows a small agent label above it:
    "triage" | "symptom_collector" | "clarification" | "rag_agent" | "report_agent"
- Typing indicator (three dots animation) while streaming
- When "complete" event arrives:
    - Show a green banner: "Your pre-screening is complete"
    - Disable input
    - Show a button: "View Report" → /diagnostics/:id

Message types to render:
- Regular text (most messages)
- Emergency message (urgency=EMERGENCY): full-width red alert card with phone icon,
    bold text "Please call emergency services immediately"
- System messages (agent transitions): small centered gray text

Input area:
- Fixed at bottom
- Text area (expandable, max 4 lines)
- Send button (disabled while AI is responding)
- Character counter (optional)

WebSocket states:
- Connecting: spinner overlay
- Connected: normal
- Disconnected: yellow banner "Reconnecting..."
- Error: red banner with error message
```

---

## 12. Diagnostic Report UI Specification

The pre-diagnostic report is what connects the AI to the doctor. Display it clearly.

```
Sections of a DiagnosticReport:
1. Header
   - Urgency badge (large, colored)
   - Suggested specialty
   - Created date
   - Status badge (PENDING_REVIEW / REVIEWED / ARCHIVED)

2. Symptoms Summary
   - AI-generated paragraph describing collected symptoms
   - Severity bar (1-10 scale, colored: green→yellow→red)

3. Possible Conditions
   - Card list, each showing:
     - Condition name
     - Confidence badge (low=gray, medium=yellow, high=green)
     - Short description

4. Sources
   - Compact list of MedlinePlus/PubMed links used

5. Recommendations
   - AI-generated text

6. Disclaimer (always shown, small text at bottom)
   - "This is an AI-assisted pre-screening, not a medical diagnosis."

7. Doctor Review Section (only shown when status ≠ PENDING_REVIEW, or for doctors)
   - Doctor notes
   - Reviewed by (doctor name)
   - Review date
```

---

## 13. Emotion Stream UI Specification

Shown only on the doctor's session page, never to patients.

```
Position: Small collapsible panel, bottom-right of the session view
Size: ~300px wide when expanded

Content:
- Live emotion bar chart (horizontal bars, updates in real-time):
    happy     ████░░░░  35%
    neutral   ███░░░░░  28%
    sad       ██░░░░░░  18%
    fearful   █░░░░░░░  10%
    angry     █░░░░░░░   9%
- Dominant emotion label (large, colored)
- Confidence score (small text)
- "Recording" pulsing red dot while active

Collapse button: doctor can minimize it during the session
Data privacy note: "Emotion data is only visible to you"
```

---

## 14. Integration Checklist for Each Page

When building each page, use this checklist:

**Auth:**
- [ ] Get Supabase session via `createClient().auth.getSession()`
- [ ] Pass `session.access_token` as `Authorization: Bearer <token>` to NestJS
- [ ] On 401 from NestJS: redirect to `/login`

**API calls:**
- Base URL from `process.env.NEXT_PUBLIC_API_URL`
- All NestJS calls: `fetch(${API_URL}/endpoint, { headers: { Authorization: Bearer ${token} } })`

**WebSocket (chat):**
- URL: `${process.env.NEXT_PUBLIC_AI_WS_URL}/chat/{chatSessionId}`
- Open after getting `chatSessionId` from `POST /ai-proxy/chat/start`

**WebSocket (emotion):**
- URL: `${process.env.NEXT_PUBLIC_AI_WS_URL}/emotion/stream/{sessionId}`
- Open after `PATCH /sessions/{id}/start`
- Send frames as: `ws.send(JSON.stringify({ frame: base64String }))`

**File uploads (face):**
- Use `FormData`, send to `POST /ai-proxy/face/enroll` or `POST /ai-proxy/face/verify`
- Field names: `photos` (enroll, multiple) and `photo` (verify, single)
- Include `Authorization` header

---

## 15. What the Backend Returns on Error

NestJS uses standard HTTP status codes:
```
400 Bad Request      → validation error, body has { message: string[] }
401 Unauthorized     → no/invalid JWT
403 Forbidden        → wrong role or not your resource
404 Not Found        → resource doesn't exist
409 Conflict         → duplicate (e.g. specialty slug already taken)
500 Internal Error   → server error
```

FastAPI errors:
```
422 Unprocessable    → face detection failed (no face in photo)
404 Not Found        → session/embedding not found
500 Internal Error   → LLM or DB error
```
