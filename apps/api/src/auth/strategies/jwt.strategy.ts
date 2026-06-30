import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { resolvePublicKey } from './supabase-jwks';

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
    const supabaseUrl = configService.getOrThrow<string>('SUPABASE_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        _req: unknown,
        _rawJwt: string,
        done: (err: Error | null, key?: string) => void,
      ) => {
        resolvePublicKey(supabaseUrl)
          .then(key => done(null, key))
          .catch(err => done(err as Error));
      },
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
