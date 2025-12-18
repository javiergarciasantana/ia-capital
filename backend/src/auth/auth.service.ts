// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // Útil si usas Passport local (opcional)
  async validateUser(email: string, pass: string): Promise<Partial<User> | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      if (!user.isActive) {
        // Si quieres, puedes devolver null aquí y que Passport maneje el error
        throw new ForbiddenException('Usuario dado de baja. Contacte con su gestor.');
      }
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(email: string, password: string): Promise<{ access_token: string }> {

    console.log('AuthService.login called with:', email, password);
    const user = await this.usersService.findByEmail(email);
    console.log('User from DB:', user);
    if (!user) {
      console.log('No user found for email:', email);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', passwordMatch);
    if (!passwordMatch) {
      console.log('Password does not match for user:', email);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) {
      console.log('User is not active:', email);
      throw new ForbiddenException('Usuario dado de baja. Contacte con su gestor.');
    }

    if (!user.isActive) {
      // 403 explícito para comunicar “baja”
      throw new ForbiddenException('Usuario dado de baja. Contacte con su gestor.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: '2h',
      }),
    };
  }
}
