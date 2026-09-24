import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
  userGroups: string[];
  permissions: string[];
  strategy?: string;
}

/**
 * Convierte el contenido de un JWT ya verificado en la identidad con la que se
 * autoriza: la usan tanto las rutas HTTP (JwtStrategy) como el websocket, para
 * que ambos vean el mismo rol, equipos y permisos.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Un JWT firmado no basta: el rol, los permisos y los equipos se leen de la
   * base de datos en cada request, no del token. Antes se confiaba en lo que
   * el token traía desde el login, así que un usuario desactivado o borrado, o
   * al que se le cambiaba el rol o se le sacaba de un equipo, conservaba sus
   * permisos hasta que el token caducaba (10 h por defecto).
   */
  async resolve(payload: any): Promise<AuthenticatedUser> {
    // cast userId to string in case it is a number
    // Backward compatibility for userId as number v3.0.0
    const userId: string | undefined =
      typeof payload.userId === 'number'
        ? payload.userId.toString()
        : payload.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }

    // findById incluye role y userGroups; el tipo Partial<PrismaUser> no los declara
    const user = (await this.usersService.findById(userId)) as any;
    if (!user || user.isActive === false) {
      this.logger.warn(`Rejected token of missing or disabled user ${userId}`);
      throw new UnauthorizedException();
    }

    const rolePermissions = await this.rolesService.getPermissions(
      user.role?.id,
    );
    let permissions: string[] = rolePermissions.map(
      (p: any) => `${p.resource}:${p.action}`,
    );

    if (payload.strategy === 'token') {
      // Token personal: si trae el id de su fila (jti) tiene que seguir
      // existiendo y activa (así se revoca borrándolo). Los emitidos antes de
      // que existiera el jti siguen valiendo hasta caducar.
      if (payload.jti) {
        const token = await this.usersService.findToken(payload.jti);
        if (
          !token ||
          token.userId !== userId ||
          token.isActive === false ||
          token.expiresAt.getTime() < Date.now()
        ) {
          this.logger.warn(`Rejected revoked or expired token ${payload.jti}`);
          throw new UnauthorizedException();
        }
      }
      // un token nunca puede tener más permisos que su usuario hoy, ni más de
      // los que se le dieron al crearlo
      const granted: string[] = payload.permissions ?? [];
      permissions = permissions.filter((p) => granted.includes(p));
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role?.name ?? 'none',
      userGroups: (user.userGroups ?? []).map((g: any) => g.name),
      permissions,
      strategy: payload.strategy,
    };
  }
}
