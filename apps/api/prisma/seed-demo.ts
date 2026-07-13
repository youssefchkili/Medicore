/**
 * Demo data seeder — creates realistic doctors & patients for local testing.
 *
 * Each account is a REAL Supabase auth user (so it can log in) plus its
 * Profile + Doctor/Patient rows. Doctors also get availability slots so the
 * booking flow is testable end-to-end.
 *
 * Usage:
 *   npm run seed:demo               # defaults: 15 doctors, 30 patients
 *   npm run seed:demo -- 25 60      # 25 doctors, 60 patients
 *
 * Login for every seeded account: email shown in the summary + DEMO_PASSWORD.
 * Re-running is safe: existing emails are detected and skipped.
 *
 * Requires (dev deps): @supabase/supabase-js, @faker-js/faker
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Config ──────────────────────────────────────────────────────────────────
const DOCTOR_COUNT = Number(process.argv[2] ?? process.env.DEMO_DOCTORS ?? 15);
const PATIENT_COUNT = Number(process.argv[3] ?? process.env.DEMO_PATIENTS ?? 30);
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';
const EMAIL_DOMAIN = 'medicore.test';

// Prisma accepts these string literals directly for its enum-typed fields.
type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;
const BLOOD_TYPES = [
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG',
  'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG',
] as const;
const ALLERGIES = ['Penicillin', 'Peanuts', 'Latex', 'Aspirin', 'Pollen', 'Shellfish', 'Ibuprofen'];
const CONDITIONS = ['Hypertension', 'Type 2 Diabetes', 'Asthma', 'Migraine', 'Hypothyroidism', 'GERD'];

// ── Clients ─────────────────────────────────────────────────────────────────
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/api/.env');
}
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in apps/api/.env');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Map every existing auth user's email → id, so re-runs reuse them instead of erroring. */
async function loadExistingUsers(client: SupabaseClient): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  let page = 1;
  // listUsers is paginated (1000/page max); walk until a short page is returned.
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    for (const user of data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  return byEmail;
}

/** Reuse the existing auth user if present, otherwise create a confirmed one. Returns its id. */
async function getOrCreateAuthUser(
  existing: Map<string, string>,
  email: string,
  firstName: string,
  lastName: string,
  role: Role,
): Promise<string> {
  // The web app routes off a LOWERCASE user_metadata.role ("patient"/"doctor"/"admin").
  // (The DB Profile.role stays uppercase — that's the Prisma enum, set separately.)
  const metaRole = role.toLowerCase();

  const found = existing.get(email.toLowerCase());
  if (found) {
    // Heal metadata on re-runs (earlier runs wrote uppercase role → broke login routing).
    await supabase.auth.admin.updateUserById(found, {
      user_metadata: { firstName, lastName, role: metaRole },
    });
    return found;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { firstName, lastName, role: metaRole },
  });
  if (error || !data.user) {
    throw new Error(`createUser failed for ${email}: ${error?.message ?? 'no user returned'}`);
  }
  existing.set(email.toLowerCase(), data.user.id);
  return data.user.id;
}

/** Future 30-min availability slots: next 5 weekdays, 09:00–12:00. */
function buildSlots(): { startTime: Date; endTime: Date }[] {
  const slots: { startTime: Date; endTime: Date }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let daysAdded = 0;
  while (daysAdded < 5) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    daysAdded += 1;
    for (let hour = 9; hour < 12; hour++) {
      for (const minute of [0, 30]) {
        const startTime = new Date(cursor);
        startTime.setHours(hour, minute, 0, 0);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
        slots.push({ startTime, endTime });
      }
    }
  }
  return slots;
}

// ── Seeders ─────────────────────────────────────────────────────────────────

async function seedDoctors(existing: Map<string, string>, created: string[]): Promise<void> {
  const specialties = await prisma.specialty.findMany({ where: { isActive: true } });
  if (specialties.length === 0) {
    throw new Error('No specialties found — run `npm run seed` (specialties) first.');
  }

  for (let i = 1; i <= DOCTOR_COUNT; i++) {
    const email = `demo.doctor.${i}@${EMAIL_DOMAIN}`;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const specialty = faker.helpers.arrayElement(specialties);

    const id = await getOrCreateAuthUser(existing, email, firstName, lastName, 'DOCTOR');

    // 1. Ensure the profile exists AND is approved. Logging in as this account may have
    //    created a bare, inactive profile via /auth/sync-profile — heal it here.
    await prisma.profile.upsert({
      where: { id },
      update: { role: 'DOCTOR', isActive: true, firstName, lastName },
      create: {
        id,
        role: 'DOCTOR',
        firstName,
        lastName,
        phone: faker.phone.number(),
        gender: faker.helpers.arrayElement(GENDERS),
        isActive: true, // approved — visible to patients and able to log in
        avatarUrl: faker.image.avatarGitHub(),
      },
    });

    // 2. Ensure the Doctor row exists. sync-profile skips it (no specialty/license),
    //    so a bare profile can exist without a doctor row — create it if missing.
    const existingDoctor = await prisma.doctor.findUnique({ where: { profileId: id } });
    if (existingDoctor) {
      console.log(`  · doctor  ${email}  (already seeded)`);
      continue;
    }
    await prisma.doctor.create({
      data: {
        profileId: id,
        specialtyId: specialty.id,
        licenseNumber: `MD-${100000 + i}`,
        bio: faker.lorem.sentences(2),
        yearsExperience: faker.number.int({ min: 2, max: 35 }),
        consultationFee: faker.number.int({ min: 40, max: 300 }),
        rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }),
        isAvailable: true,
        faceRegistered: false, // no face 2FA → password login works
        status: 'ACTIVE',
        availabilitySlots: { create: buildSlots() },
      },
    });
    created.push(email);
    console.log(`  ✓ doctor  ${email}  (${specialty.name}, Dr. ${firstName} ${lastName})`);
  }
}

async function seedPatients(existing: Map<string, string>, created: string[]): Promise<void> {
  for (let i = 1; i <= PATIENT_COUNT; i++) {
    const email = `demo.patient.${i}@${EMAIL_DOMAIN}`;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const id = await getOrCreateAuthUser(existing, email, firstName, lastName, 'PATIENT');

    // 1. Ensure the profile exists (login/sync-profile may have made a bare one).
    await prisma.profile.upsert({
      where: { id },
      update: { role: 'PATIENT', isActive: true, firstName, lastName },
      create: {
        id,
        role: 'PATIENT',
        firstName,
        lastName,
        phone: faker.phone.number(),
        dateOfBirth: faker.date.birthdate({ min: 18, max: 85, mode: 'age' }),
        gender: faker.helpers.arrayElement(GENDERS),
        isActive: true,
        avatarUrl: faker.image.avatarGitHub(),
      },
    });

    // 2. Ensure the Patient row exists — create it if the profile has none.
    const existingPatient = await prisma.patient.findUnique({ where: { profileId: id } });
    if (existingPatient) {
      console.log(`  · patient ${email}  (already seeded)`);
      continue;
    }
    await prisma.patient.create({
      data: {
        profileId: id,
        bloodType: faker.helpers.arrayElement(BLOOD_TYPES),
        allergies: faker.helpers.arrayElements(ALLERGIES, { min: 0, max: 3 }),
        chronicConditions: faker.helpers.arrayElements(CONDITIONS, { min: 0, max: 2 }),
      },
    });
    created.push(email);
    console.log(`  ✓ patient ${email}  (${firstName} ${lastName})`);
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`\nSeeding ${DOCTOR_COUNT} doctors + ${PATIENT_COUNT} patients...`);
  console.log('Loading existing auth users (for idempotency)...');
  const existing = await loadExistingUsers(supabase);
  const created: string[] = [];

  console.log('\nDoctors:');
  await seedDoctors(existing, created);
  console.log('\nPatients:');
  await seedPatients(existing, created);

  console.log('\n──────────────────────────────────────────────');
  console.log(`Done. Created ${created.length} new account(s).`);
  console.log(`Password for ALL seeded accounts: ${DEMO_PASSWORD}`);
  console.log('Sample logins:');
  console.log(`  Doctor : demo.doctor.1@${EMAIL_DOMAIN}`);
  console.log(`  Patient: demo.patient.1@${EMAIL_DOMAIN}`);
  console.log('──────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('\nSeed failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
