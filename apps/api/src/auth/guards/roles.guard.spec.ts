import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SKIP_ROLES_KEY } from '../decorators/skip-roles-check.decorator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Builds a fake ExecutionContext that carries a user with a specific role.
// ExecutionContext is what NestJS passes to every guard's canActivate().
// We only need the parts that RolesGuard actually uses.
function buildContext(userRole?: Role): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: userRole ? { role: userRole } : undefined,
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

// Configures the mocked Reflector to return specific values for SKIP_ROLES_KEY and ROLES_KEY.
// This simulates what happens when you put @SkipRolesCheck() or @Roles(Role.X) on a method.
function setupReflector(
  reflector: jest.Mocked<Reflector>,
  skipCheck: boolean | undefined,
  roles: Role[] | undefined,
) {
  reflector.getAllAndOverride.mockImplementation((key: string) => {
    if (key === SKIP_ROLES_KEY) return skipCheck;
    if (key === ROLES_KEY) return roles;
    return undefined;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    // Create a mocked Reflector — getAllAndOverride will be replaced per test
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  // ─── @SkipRolesCheck() ────────────────────────────────────────────────────

  it('returns true when @SkipRolesCheck() is present, regardless of role', () => {
    // Simulates a method decorated with @SkipRolesCheck()
    // Expected: guard lets the request through for any authenticated user
    setupReflector(reflector, true, undefined);
    expect(guard.canActivate(buildContext(Role.PATIENT))).toBe(true);
  });

  // ─── Default deny ─────────────────────────────────────────────────────────

  it('returns false when no @Roles() and no @SkipRolesCheck() are set', () => {
    // This is the "default deny" we added — a guard applied without @Roles() is now secure
    // Before our fix this would have returned true, letting anyone through
    setupReflector(reflector, undefined, undefined);
    expect(guard.canActivate(buildContext(Role.PATIENT))).toBe(false);
  });

  // ─── Correct role ─────────────────────────────────────────────────────────

  it('returns true when the user has exactly the required role', () => {
    // Simulates @Roles(Role.PATIENT) on a method — a PATIENT user should pass
    setupReflector(reflector, undefined, [Role.PATIENT]);
    expect(guard.canActivate(buildContext(Role.PATIENT))).toBe(true);
  });

  it('returns true when the user has one of multiple allowed roles', () => {
    // Simulates @Roles(Role.DOCTOR, Role.ADMIN) — both are allowed
    setupReflector(reflector, undefined, [Role.DOCTOR, Role.ADMIN]);
    expect(guard.canActivate(buildContext(Role.ADMIN))).toBe(true);
  });

  // ─── Wrong role ───────────────────────────────────────────────────────────

  it('returns false when the user role does not match the required role', () => {
    // Simulates @Roles(Role.ADMIN) — a PATIENT should be rejected
    setupReflector(reflector, undefined, [Role.ADMIN]);
    expect(guard.canActivate(buildContext(Role.PATIENT))).toBe(false);
  });

  it('returns false when there is no user in the request', () => {
    // Handles the edge case where JwtAuthGuard somehow lets a request through without a user
    setupReflector(reflector, undefined, [Role.PATIENT]);
    expect(guard.canActivate(buildContext(undefined))).toBe(false);
  });
});
