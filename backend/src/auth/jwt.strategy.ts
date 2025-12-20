import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-insecure',
    });
    console.log('JwtStrategy secret:', process.env.JWT_SECRET || 'dev-insecure');
  }
  async validate(payload: any) {
    console.log("validation")
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
