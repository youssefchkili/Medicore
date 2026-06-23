import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    if (!secret || secret !== this.config.getOrThrow('AI_SERVICE_SECRET')) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
