import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/create-app';
import { makeToken, TEST_PATIENT, TEST_DOCTOR } from './helpers/make-token';
import { MockPrisma } from './helpers/mock-prisma';

// ─── What this file tests ──────────────────────────────────────────────────────
//
// These tests go past the auth layer and actually reach the service.
// They verify that:
//   - Invalid UUIDs are rejected before hitting the service (ValidationPipe)
//   - 404 is returned when a resource doesn't exist (service layer)
//   - IDOR: a patient cannot read another patient's appointment (ownership check)
//   - Business rules: double-booking, cancellation rules

describe('Appointments (e2e)', () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Input validation ─────────────────────────────────────────────────────────

  describe('Input validation', () => {
    it('GET /appointments/:id with a non-UUID → 400', async () => {
      // ParseUUIDPipe in the controller rejects non-UUID strings
      // This happens before the service is ever called
      await request(app.getHttpServer())
        .get('/appointments/not-a-valid-uuid')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .expect(400);
    });

    it('GET /availability/:doctorId with a non-UUID → 400', async () => {
      await request(app.getHttpServer())
        .get('/availability/not-a-valid-uuid')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .expect(400);
    });
  });

  // ─── 404 — Resource not found ─────────────────────────────────────────────────

  describe('Not found (404)', () => {
    it('GET /appointments/:id → 404 when the appointment does not exist', async () => {
      // The service calls prisma.appointment.findUnique → returns null → throws NotFoundException
      prisma.appointment.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/appointments/aaaaaaaa-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .expect(404);
    });
  });

  // ─── IDOR — Ownership check ────────────────────────────────────────────────────
  //
  // IDOR = Insecure Direct Object Reference.
  // The test: Patient A makes a request for Patient B's appointment ID.
  // Expected: 403 Forbidden (the service's assertParticipant() check)

  describe('IDOR protection (ownership checks)', () => {
    it('patient A cannot read patient B\'s appointment → 403', async () => {
      // The appointment belongs to a DIFFERENT patient (profileId does not match TEST_PATIENT.id)
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-belongs-to-other-patient',
        patient: { profileId: 'other-patient-profile-id' }, // ← NOT TEST_PATIENT.id
        doctor: { profileId: 'some-doctor-profile-id' },
      });

      await request(app.getHttpServer())
        .get('/appointments/aaaaaaaa-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`) // logged in as TEST_PATIENT
        .expect(403);
    });

    it('patient A cannot cancel patient B\'s appointment → 403', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-belongs-to-other-patient',
        status: 'SCHEDULED',
        slot: { id: 'slot-1' },
        patient: { profileId: 'other-patient-profile-id', profile: {} },
        doctor: { profileId: 'some-doctor-profile-id', profile: {} },
      });

      await request(app.getHttpServer())
        .patch('/appointments/aaaaaaaa-0000-0000-0000-000000000001/cancel')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .send({ reason: 'I want to cancel someone else\'s appointment' })
        .expect(403);
    });
  });

  // ─── Business rules ────────────────────────────────────────────────────────────

  describe('Business rules', () => {
    it('POST /appointments → 400 when the slot is already booked', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        id: TEST_PATIENT.patient!.id,
        profileId: TEST_PATIENT.id,
      });

      // $transaction calls the callback with a fake tx object
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        return cb({
          availabilitySlot: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'slot-1',
              isBooked: true, // ← already taken
              doctorId: TEST_DOCTOR.doctor!.id,
              startTime: new Date(Date.now() + 3600000),
            }),
            update: jest.fn(),
          },
          appointment: { create: jest.fn() },
        });
      });

      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .send({
          slotId: 'aaaaaaaa-0000-0000-0000-000000000010',
          doctorId: TEST_DOCTOR.doctor!.id,
        })
        .expect(400);
    });

    it('PATCH /appointments/:id/cancel → 400 when the appointment is already cancelled', async () => {
      // The appointment belongs to TEST_PATIENT and is already cancelled
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: 'CANCELLED', // ← already done
        slot: { id: 'slot-1' },
        patient: { profileId: TEST_PATIENT.id, profile: {} },
        doctor: { profileId: TEST_DOCTOR.id, profile: {} },
      });

      await request(app.getHttpServer())
        .patch('/appointments/aaaaaaaa-0000-0000-0000-000000000001/cancel')
        .set('Authorization', `Bearer ${makeToken(TEST_PATIENT)}`)
        .send({ reason: 'trying to cancel again' })
        .expect(400);
    });

    it('doctor can confirm their own appointment → the service is reached', async () => {
      // This test verifies the doctor CAN reach the confirm endpoint (no 403)
      // The service will call prisma.appointment.findUnique — we set it up to return
      // an appointment that belongs to TEST_DOCTOR
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: 'SCHEDULED',
        patient: { profileId: TEST_PATIENT.id, profile: { id: TEST_PATIENT.id, firstName: 'Jane', lastName: 'Patient' } },
        doctor: {
          profileId: TEST_DOCTOR.id,
          profile: { id: TEST_DOCTOR.id, firstName: 'John', lastName: 'Doctor' },
        },
        slot: { id: 'slot-1' },
      });

      prisma.appointment.update.mockResolvedValue({
        id: 'appt-1',
        status: 'CONFIRMED',
        patient: { profile: { id: TEST_PATIENT.id, firstName: 'Jane', lastName: 'Patient' } },
        doctor: { profile: { id: TEST_DOCTOR.id, firstName: 'John', lastName: 'Doctor' } },
        slot: {},
        preDiagnostic: null,
      });

      // We expect either 200 or 201 — the key is it's NOT a 403 or 401
      const res = await request(app.getHttpServer())
        .patch('/appointments/aaaaaaaa-0000-0000-0000-000000000001/confirm')
        .set('Authorization', `Bearer ${makeToken(TEST_DOCTOR)}`);

      expect(res.status).toBeLessThan(400);
    });
  });
});
