import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../modules/auth/guards/jwt-auth.guard.js';

const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'clientes',
  PROVIDER: 'prestadores',
};

/**
 * Autorização por perfil. Tem de correr depois do JwtAuthGuard, que é quem
 * preenche request.user. Sem @Roles() a rota fica livre para qualquer perfil.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!required.includes(user.role)) {
      const allowed = required.map((role) => ROLE_LABELS[role]).join(' e ');
      throw new ForbiddenException(`Apenas ${allowed} podem executar esta ação`);
    }
    return true;
  }
}
