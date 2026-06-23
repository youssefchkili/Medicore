import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;   // Supabase auth.uid()
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase signs JWTs with the raw bytes of the secret (base64-encoded in dashboard)
      secretOrKey: Buffer.from(
        configService.getOrThrow<string>('SUPABASE_JWT_SECRET'),
        'base64',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
      include: { doctor: true, patient: true },
    });
    if (!profile || !profile.isActive) throw new UnauthorizedException();
    return profile;
  }
}
