import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Profile } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Shared test fixtures ─────────────────────────────────────────────────────
// These are fake Prisma records we reuse across tests.

const PATIENT_PROFILE: Profile = {
  id: 'profile-patient-1',
  role: Role.PATIENT,
  isActive: true,
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: new Date(),
  updatedAt: new Date(),
  phoneNumber: null,
  dateOfBirth: null,
  gender: null,
  avatarUrl: null,
} as unknown as Profile;

const DOCTOR_PROFILE: Profile = {
  id: 'profile-doctor-1',
  role: Role.DOCTOR,
  isActive: true,
  firstName: 'Dr. John',
  lastName: 'Smith',
  createdAt: new Date(),
  updatedAt: new Date(),
  phoneNumber: null,
  dateOfBirth: null,
  gender: null,
  avatarUrl: null,
} as unknown as Profile;

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
const PAST_DATE = new Date(Date.now() - 1000); // 1 second ago

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  // These are the mock versions of the dependencies — jest.fn() for every method
  const mockPrisma = {
    patient: { findUnique: jest.fn() },
    doctor: { findUnique: jest.fn() },
    availabilitySlot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // NotificationsService.send() is fire-and-forget in the real code (.catch() after it).
  // We mock it so no real email is sent and we can verify it was/wasn't called.
  const mockNotifications = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(AppointmentsService);

    // Reset all mock call histories before each test so tests don't bleed into each other
    jest.clearAllMocks();
  });

  // ─── createSlot() ─────────────────────────────────────────────────────────

  describe('createSlot()', () => {
    it('throws BadRequestException when startTime is in the past', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-1' });

      await expect(
        service.createSlot(DOCTOR_PROFILE, {
          startTime: PAST_DATE.toISOString(),
          endTime: new Date(PAST_DATE.getTime() + 3600000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when endTime is before startTime', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-1' });
      const start = new Date(Date.now() + 3600000); // 1 hour from now
      const end = new Date(start.getTime() - 1000);  // 1 second before start

      await expect(
        service.createSlot(DOCTOR_PROFILE, {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the doctor record does not exist', async () => {
      // Edge case: profile exists but the doctor sub-record was not created yet
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(
        service.createSlot(DOCTOR_PROFILE, {
          startTime: FUTURE_DATE.toISOString(),
          endTime: new Date(FUTURE_DATE.getTime() + 3600000).toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── book() ───────────────────────────────────────────────────────────────

  describe('book()', () => {
    it('throws NotFoundException when the patient record does not exist', async () => {
      // The patient profile exists but the Patient sub-record was not initialised yet
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        service.book(PATIENT_PROFILE, { slotId: 'slot-1', doctorId: 'doc-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the slot is already booked', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'patient-1' });

      // $transaction calls our callback immediately with a fake tx object.
      // This is how we test code that runs inside a database transaction.
      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const fakeTx = {
          availabilitySlot: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'slot-1',
              isBooked: true, // ← the slot is taken
              doctorId: 'doc-1',
              startTime: FUTURE_DATE,
            }),
            update: jest.fn(),
          },
          appointment: { create: jest.fn() },
        };
        return cb(fakeTx);
      });

      await expect(
        service.book(PATIENT_PROFILE, { slotId: 'slot-1', doctorId: 'doc-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the slot is in the past', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'patient-1' });

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const fakeTx = {
          availabilitySlot: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'slot-1',
              isBooked: false,
              doctorId: 'doc-1',
              startTime: PAST_DATE, // ← slot is in the past
            }),
            update: jest.fn(),
          },
          appointment: { create: jest.fn() },
        };
        return cb(fakeTx);
      });

      await expect(
        service.book(PATIENT_PROFILE, { slotId: 'slot-1', doctorId: 'doc-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when slotId does not belong to the doctorId', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'patient-1' });

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const fakeTx = {
          availabilitySlot: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'slot-1',
              isBooked: false,
              doctorId: 'different-doctor', // ← slot belongs to another doctor
              startTime: FUTURE_DATE,
            }),
            update: jest.fn(),
          },
          appointment: { create: jest.fn() },
        };
        return cb(fakeTx);
      });

      await expect(
        service.book(PATIENT_PROFILE, { slotId: 'slot-1', doctorId: 'doc-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancel() ─────────────────────────────────────────────────────────────

  describe('cancel()', () => {
    it('throws ForbiddenException when the user is not a participant of the appointment', async () => {
      // A third user who is neither the patient nor the doctor tries to cancel
      const anotherProfile = { ...PATIENT_PROFILE, id: 'profile-stranger' } as Profile;

      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: 'SCHEDULED',
        slot: { id: 'slot-1' },
        patient: { profileId: 'profile-patient-1', profile: {} }, // belongs to PATIENT_PROFILE
        doctor: { profileId: 'profile-doctor-1', profile: {} },  // belongs to DOCTOR_PROFILE
      });

      await expect(
        service.cancel(anotherProfile, 'appt-1', { reason: 'test' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the appointment is already cancelled', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: 'CANCELLED', // ← already done
        slot: { id: 'slot-1' },
        patient: { profileId: PATIENT_PROFILE.id, profile: {} },
        doctor: { profileId: 'profile-doctor-1', profile: {} },
      });

      await expect(
        service.cancel(PATIENT_PROFILE, 'appt-1', { reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the appointment is already completed', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: 'COMPLETED', // ← cannot cancel a completed appointment
        slot: { id: 'slot-1' },
        patient: { profileId: PATIENT_PROFILE.id, profile: {} },
        doctor: { profileId: 'profile-doctor-1', profile: {} },
      });

      await expect(
        service.cancel(PATIENT_PROFILE, 'appt-1', { reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── deleteSlot() ─────────────────────────────────────────────────────────

  describe('deleteSlot()', () => {
    it('throws ForbiddenException when a doctor tries to delete another doctor\'s slot', async () => {
      mockPrisma.availabilitySlot.findUnique.mockResolvedValue({
        id: 'slot-1',
        isBooked: false,
        doctor: { profileId: 'different-doctor-profile' }, // belongs to someone else
      });

      await expect(
        service.deleteSlot(DOCTOR_PROFILE, 'slot-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when trying to delete a booked slot', async () => {
      mockPrisma.availabilitySlot.findUnique.mockResolvedValue({
        id: 'slot-1',
        isBooked: true, // ← a patient already booked this slot
        doctor: { profileId: DOCTOR_PROFILE.id },
      });

      await expect(
        service.deleteSlot(DOCTOR_PROFILE, 'slot-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
