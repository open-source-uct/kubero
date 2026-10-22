import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { AuthenticatedUser } from '../auth/identity.service';

@Injectable()
export class TokenService {
  private readonly prisma = new PrismaClient();
  private logger = new Logger(TokenService.name);

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private rolesService: RolesService,
  ) {}
  async findAll(): Promise<any[]> {
    return this.prisma.token.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async create(
    name: string,
    expiresAt: string,
    userId: string,
    caller: AuthenticatedUser,
  ): Promise<{
    name: string;
    token: string;
    expiresAt: string;
  }> {
    if (
      !caller ||
      caller.userId !== userId ||
      !['local', 'oauth2'].includes(caller.strategy ?? '')
    ) {
      throw new ForbiddenException('Interactive session required');
    }
    if (!name || !expiresAt || !userId) {
      throw new Error('Invalid token data');
    }

    // se leen el rol, los equipos y los permisos actuales del usuario desde
    // la base de datos, en vez de confiar en los datos de su sesión (que
    // pueden estar desactualizados si su rol o sus equipos cambiaron después
    // de haber iniciado sesión)
    // se castea a any porque findById() incluye relaciones (role, userGroups)
    // que el tipo Partial<PrismaUser> no declara
    const user = (await this.usersService.findById(userId)) as any;
    if (!user || user.isActive === false) {
      throw new Error('User not found');
    }

    const role = user.role?.name || 'guest';
    const userGroups = user.userGroups || [];
    const { permissions, scopeToOwnTeam, priority } =
      await this.rolesService.getPermissions(user.role?.id);
    const permissionStrings = permissions.map(
      (p: any) => `${p.resource}:${p.action}`,
    );

    const userGroupsString = userGroups
      .map((group: any) => group.name)
      .join(',');
    const newToken = {
      name: name || '', // Optional name field
      role: role,
      groups: userGroupsString || '', // Store user groups as a string
      expiresAt: new Date(expiresAt),
      user: {
        connect: { id: userId },
      },
    };
    // La fila se crea primero para firmar el JWT con su id (jti): al borrar el
    // token, ese id deja de existir y el JWT deja de valer.
    const row = await this.prisma.token.create({
      data: newToken,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    let token: string;
    try {
      token = await this.authService.generateToken(
        userId,
        user.username,
        role,
        userGroups.map((group: any) => group.name),
        permissionStrings,
        expiresAt,
        row.id,
        scopeToOwnTeam,
        priority,
      );
    } catch (error) {
      // no dejar una fila sin JWT
      await this.prisma.token.delete({ where: { id: row.id } });
      throw error;
    }

    return {
      name: name,
      token: token,
      expiresAt: expiresAt,
    };
  }

  // Un token solo lo puede borrar su propio dueño, salvo que quien pida el
  // borrado tenga token:write (hoy solo admin): si no, cualquier rol con
  // token:ok (profesor/webmaster/estudiante) podría revocar el token de
  // cualquier otro usuario adivinando su id.
  async delete(
    id: string,
    callerId: string,
    canManageAnyToken = false,
  ): Promise<any> {
    if (!canManageAnyToken) {
      const token = await this.prisma.token.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!token || token.userId !== callerId) {
        throw new ForbiddenException(
          'No puedes borrar un token que no es tuyo',
        );
      }
    }
    return this.prisma.token.delete({
      where: { id },
    });
  }
}
