import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/create-app';
import { makeToken, TEST_PATIENT, TEST_DOCTOR, TEST_ADMIN } from './helpers/make-token';
import { MockPrisma } from './helpers/mock-prisma';

// ─── What this file tests ──────────────────────────────────────────────────────
//
// This is an E2E authorization test suite. It does NOT test business logic.
// It answers one question: "for every role combination, does the app return
// the right HTTP status code?"
//
// 401 = Unauthorized  → no token was sent (not authenticated at all)
// 403 = Forbidden     → token is valid but the role is wrong
// 200 = OK            → authenticated AND correct role
//
// The RolesGuard is REAL in these tests — we test it for real.
// The JwtAuthGuard is MOCKED — it decodes our base64 test tokens instead of calling Supabase.

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  // Create the app once for the whole file (faster than creating it per test)
  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  // Reset mock call history before each test so tests don't affect each other
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Public routes — no token required ───────────────────────────────────────

  describe('Public endpoints (no auth required)', () => {
    it('GET / → 200 even without a token', async () => {
      // The health check is decorated with @Public() — should always work
      await request(app.getHttpServer())
        .get('/')
        .expect(200);
    });
  });

  // ─── 401 — No token sent ──────────────────────────────────────────────────────

  describe('Unauthenticated requests (expect 401)', () => {
    it('GET /users/me → 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });

    it('GET /appointments → 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/appointments')
        .expect(401);
    });

    it('GET /notifications → 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .expect(401);
    });

    it('GET /admin/stats → 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/admin/stats')
        .expect(401);
    });

    it('GET /medical-records → 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/medical-records')
        .expect(401);
    });
  });

  // ─── 403 — Correct token, wrong role ─────────────────────────────────────────

  describe('Role-based access control (expect 403)', () => {
    // Patient trying to access admin endpoints
    it('patient → GET /admin/stats → 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .expect(403);
    });

    it('doctor → GET /admin/stats → 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${makeToken(TEST_DOCTOR)}`)
        .expect(403);
    });

    // Doctor trying to use patient-only endpoints
    it('doctor → POST /appointments (book) → 403', async () => {
      // Booking is @Roles(Role.PATIENT) — a doctor cannot book
      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${makeToken(TEST_DOCTOR)}`)
        .send({ slotId: 'aaaaaaaa-0000-0000-0000-000000000099', doctorId: 'aaaaaaaa-0000-0000-0000-000000000099' })
        .expect(403);
    });

    it('admin → POST /appointments (book) → 403', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${makeToken(TEST_ADMIN)}`)
        .send({ slotId: 'aaaaaaaa-0000-0000-0000-000000000099', doctorId: 'aaaaaaaa-0000-0000-0000-000000000099' })
        .expect(403);
    });

    // Patient trying to use doctor-only endpoints
    it('patient → PATCH /appointments/:id/confirm → 403', async () => {
      // Confirming is @Roles(Role.DOCTOR) — a patient cannot confirm
      await request(app.getHttpServer())
        .patch('/appointments/aaaaaaaa-0000-0000-0000-000000000099/confirm')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .expect(403);
    });

    it('patient → POST /availability (create slot) → 403', async () => {
      await request(app.getHttpServer())
        .post('/availability')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .send({ startTime: new Date().toISOString(), endTime: new Date().toISOString() })
        .expect(403);
    });

    it('patient → POST /medical-records → 403', async () => {
      // Creating medical records is @Roles(Role.DOCTOR) only
      await request(app.getHttpServer())
        .post('/medical-records')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .send({ patientId: 'p1', content: 'test' })
        .expect(403);
    });
  });

  // ─── 200 — Correct role and token ────────────────────────────────────────────

  describe('Correct role access (expect 200)', () => {
    it('admin → GET /admin/stats → 200', async () => {
      // Set up the mock so prisma.count() returns sensible values
      prisma.patient.count.mockResolvedValue(10);
      prisma.doctor.count.mockResolvedValue(5);
      prisma.profile.count.mockResolvedValue(2);
      prisma.appointment.count.mockResolvedValue(30);
      prisma.preDiagnostic.count.mockResolvedValue(8);

      const res = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${makeToken(TEST_ADMIN)}`)
        .expect(200);

      expect(res.body).toMatchObject({
        patients: 10,
        doctors: 5,
        appointments: 30,
      });
    });

    it('patient → GET /users/me → 200', async () => {
      // UsersService.getMe() calls prisma.profile.findUnique — mock the return value
      prisma.profile.findUnique.mockResolvedValue({
        id: TEST_PATIENT.id,
        role: 'PATIENT',
        isActive: true,
        firstName: 'Jane',
        lastName: 'Patient',
        doctor: null,
        patient: TEST_PATIENT.patient,
      });

      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .expect(200);

      expect(res.body.role).toBe('PATIENT');
    });

    it('doctor → GET /users/me → 200', async () => {
      prisma.profile.findUnique.mockResolvedValue({
        id: TEST_DOCTOR.id,
        role: 'DOCTOR',
        isActive: true,
        firstName: 'John',
        lastName: 'Doctor',
        doctor: TEST_DOCTOR.doctor,
        patient: null,
      });

      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${makeToken(TEST_DOCTOR)}`)
        .expect(200);

      expect(res.body.role).toBe('DOCTOR');
    });

    it('patient → GET /appointments → 200', async () => {
      // AppointmentsService.getMyAppointments() calls patient.findUnique then appointment.findMany
      prisma.patient.findUnique.mockResolvedValue({
        id: TEST_PATIENT.patient!.id,
        profileId: TEST_PATIENT.id,
      });
      prisma.appointment.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
