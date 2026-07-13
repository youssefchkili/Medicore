import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  // Fire-and-forget: an audit-log write must never block or fail the actual
  // request it's recording. Failures are logged, not swallowed silently.
  log(actorId: string, action: string, resourceType: string, resourceId?: string) {
    this.prisma.auditLog
      .create({ data: { actorId, action, resourceType, resourceId } })
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to write audit log for ${action} ${resourceType}/${resourceId}: ${err}`,
        ),
      );
  }
}
