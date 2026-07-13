import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Ensures onModuleDestroy (Prisma's $disconnect) runs on SIGTERM/SIGINT,
  // so the pg pool closes cleanly instead of leaking connections on container stop.
  app.enableShutdownHooks();

  await app.register(helmet);

  // Register multipart support so face enroll/verify endpoints can receive file uploads
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = config.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
