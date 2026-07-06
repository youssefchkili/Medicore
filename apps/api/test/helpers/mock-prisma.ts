// Creates a full mock of PrismaService.
// Every method is a jest.fn() — it records calls and returns undefined by default.
// Individual tests override return values with .mockResolvedValue() or .mockResolvedValueOnce().
//
// Usage in a test:
//   prisma.patient.findUnique.mockResolvedValue({ id: 'p1', profileId: 'u1' });

function makeModelMock() {
  return {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
}

export function createMockPrisma() {
  return {
    profile: makeModelMock(),
    doctor: makeModelMock(),
    patient: makeModelMock(),
    appointment: makeModelMock(),
    availabilitySlot: makeModelMock(),
    notification: makeModelMock(),
    specialty: makeModelMock(),
    session: makeModelMock(),
    medicalRecord: makeModelMock(),
    preDiagnostic: makeModelMock(),
    auditLog: makeModelMock(),
    $transaction: jest.fn(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;
