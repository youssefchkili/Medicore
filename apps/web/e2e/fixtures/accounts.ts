/**
 * Real Supabase-backed test accounts on the shared MediCore dev/staging project.
 *
 * These are NOT ephemeral test-database accounts — tests must be additive and
 * must clean up any data they create (appointments, availability slots, chat
 * sessions) wherever practical. Never leave a shared account (doctors/admin)
 * in a different state than it was found.
 */
export const PATIENT = {
  email: "youssefchkili04@gmail.com",
  password: "patient00",
};

export const DOCTOR = {
  email: "ridhachkili@gmail.com",
  password: "doctor00",
  specialty: "Neurology",
  fullName: "Ridha Chkili",
};

export const DOCTOR_2 = {
  email: "na3ne3@gmail.com",
  password: "doctor01",
  specialty: "Cardiology",
};

export const ADMIN = {
  email: "admin@gmail.com",
  password: "admin0000",
};
