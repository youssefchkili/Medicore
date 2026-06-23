import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtVerifyStrategy extends PassportStrategy(Strategy, 'jwt-verify') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: Buffer.from(
        configService.getOrThrow<string>('SUPABASE_JWT_SECRET'),
        'base64',
      ),
    });
  }

  // No DB lookup — just confirm the token is cryptographically valid
  validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email };
  }
}
