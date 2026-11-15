import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { toUserResponse, UserResponse } from '../users/user.mapper.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

const SALT_ROUNDS = 10;

export interface LoginResponse {
  accessToken: string;
  user: UserResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponse> {
    const existing = await this.usersService.findByEmailOrNif(dto.email, dto.nif);

    if (existing) {
      throw new ConflictException(
        existing.email === dto.email ? 'E-mail já registado' : 'NIF já registado',
      );
    }

    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      name: dto.name,
      nif: dto.nif,
      email: dto.email,
      role: dto.role,
      password,
    });

    return toUserResponse(user);
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const identifier = dto.identifier ?? dto.email ?? '';
    const user = await this.usersService.findByIdentifier(identifier);

    // Mesma mensagem para utilizador inexistente e password errada:
    // não revela quais e-mails ou NIFs estão registados.
    const valid = user && (await bcrypt.compare(dto.password, user.password));
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: toUserResponse(user),
    };
  }
}
