import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { createMockPrisma, MockPrisma } from './mock-prisma';

// The mock JwtAuthGuard used in every E2E test.
// In production, this guard calls the Supabase JWKS endpoint to verify RS256 tokens.
// In tests, we skip all of that and just decode the base64 JSON we put in the Bearer header.
//
// If there's no token           → throws UnauthorizedException (→ HTTP 401)
// If the token decodes fine     → sets req.user and returns true
// If the token is malformed     → throws UnauthorizedException (→ HTTP 401)
const mockJwtAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const auth: string | undefined = request.headers['authorization'];

    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();

    try {
      const user = JSON.parse(
        Buffer.from(auth.slice(7), 'base64').toString('utf-8'),
      );
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  },
};

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: MockPrisma;
}> {
  const prisma = createMockPrisma();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Replace the real DB with our mock
    .overrideProvider(PrismaService)
    .useValue(prisma)
    // Replace the real JWT guard (which needs Supabase network access)
    .overrideGuard(JwtAuthGuard)
    .useValue(mockJwtAuthGuard)
    // Disable rate limiting — tests would get 429s after a few requests otherwise
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  // Use the Fastify adapter — same as production — so we catch any Fastify-specific issues
  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  // Apply the same global pipe as production (strips unknown fields, validates DTOs)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  // Fastify requires this to finish loading its plugin chain before handling requests
  await app.getHttpAdapter().getInstance().ready();

  return { app, prisma };
}
