import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContext(): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({}) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    // We create the guard through the NestJS testing module so Reflector is injected properly
    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector);
  });

  it('immediately returns true when the route is marked @Public()', async () => {
    // Simulates a controller method with @Public() decorator
    // Expected: the guard returns true without trying to validate any JWT
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      return key === IS_PUBLIC_KEY ? true : undefined;
    });

    // We spy on the parent class canActivate to make sure it is NOT called
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockResolvedValue(true);

    const result = await guard.canActivate(buildContext());

    expect(result).toBe(true);
    // The passport super.canActivate() must not be called for public routes
    expect(superSpy).not.toHaveBeenCalled();

    superSpy.mockRestore();
  });

  it('calls through to passport when the route is NOT marked @Public()', async () => {
    // Non-public routes must go through passport JWT validation
    reflector.getAllAndOverride.mockReturnValue(undefined);

    // We mock the parent canActivate so we don't need a real passport strategy in this unit test
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockResolvedValue(true);

    await guard.canActivate(buildContext());

    expect(superSpy).toHaveBeenCalled();
    superSpy.mockRestore();
  });
});
