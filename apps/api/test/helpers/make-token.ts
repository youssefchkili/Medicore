import { Role } from '@prisma/client';

// Represents the shape of req.user after JwtAuthGuard runs.
// In production this comes from JwtStrategy.validate() (a real DB call).
// In tests we inject it directly via a mock guard.
export interface TestUser {
  id: string;
  role: Role;
  isActive: boolean;
  firstName: string;
  lastName: string;
  doctor: { id: string; faceRegistered: boolean } | null;
  patient: { id: string } | null;
}

// Encodes a user object as a base64 string — the mock JwtAuthGuard decodes this.
// Example: Authorization: Bearer eyJpZCI6Ii4uLiJ9
export function makeToken(user: TestUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64');
}

// ─── Pre-built test users (one per role) ──────────────────────────────────────

export const TEST_PATIENT: TestUser = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  role: Role.PATIENT,
  isActive: true,
  firstName: 'Jane',
  lastName: 'Patient',
  doctor: null,
  patient: { id: 'bbbbbbbb-0000-0000-0000-000000000001' },
};

export const TEST_DOCTOR: TestUser = {
  id: 'aaaaaaaa-0000-0000-0000-000000000002',
  role: Role.DOCTOR,
  isActive: true,
  firstName: 'John',
  lastName: 'Doctor',
  doctor: { id: 'cccccccc-0000-0000-0000-000000000001', faceRegistered: false },
  patient: null,
};

export const TEST_ADMIN: TestUser = {
  id: 'aaaaaaaa-0000-0000-0000-000000000003',
  role: Role.ADMIN,
  isActive: true,
  firstName: 'Super',
  lastName: 'Admin',
  doctor: null,
  patient: null,
};
