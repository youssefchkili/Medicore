import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';

const PRISMA_STATUS_MAP: Partial<Record<string, HttpStatus>> = {
  P2002: HttpStatus.CONFLICT, // unique constraint violation
  P2003: HttpStatus.BAD_REQUEST, // foreign key constraint violation
  P2025: HttpStatus.NOT_FOUND, // record to update/delete not found
};

// Prisma errors are internal implementation details (raw SQL codes, column
// names) that must never reach the client as an unhandled 500 with a stack
// trace. This maps the common cases to proper HTTP statuses and redacts the
// rest behind a generic message.
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      response.status(HttpStatus.BAD_REQUEST).send({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid request data',
      });
      return;
    }

    const status = PRISMA_STATUS_MAP[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).send({
      statusCode: status,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : `Database error (${exception.code})`,
    });
  }
}
