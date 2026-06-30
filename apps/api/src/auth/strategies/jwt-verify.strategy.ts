import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { resolvePublicKey } from './supabase-jwks';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtVerifyStrategy extends PassportStrategy(Strategy, 'jwt-verify') {
  constructor(configService: ConfigService) {
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

  // No DB lookup — just confirm the token is cryptographically valid
  validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email };
  }
}
