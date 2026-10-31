import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class RolesService {
  private readonly prisma = new PrismaClient();
  private logger = new Logger(RolesService.name);

  constructor() {}

  async findAll(scopeToOwnTeam = false, callerPriority = 0): Promise<any[]> {
    return this.prisma.role.findMany({
      // un rol acotado solo puede asignar roles también acotados y con
      // priority <= la suya — mismo criterio que
      // UsersService.assertAssignableRole, para no mostrarle roles que nunca
      // va a poder usar
      where: scopeToOwnTeam
        ? { scopeToOwnTeam: true, priority: { lte: callerPriority } }
        : undefined,
      select: {
        id: true,
        name: true,
        description: true,
        scopeToOwnTeam: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
      },
    });
  }

  async getPermissions(roleId: string | null | undefined): Promise<{
    permissions: any[];
    scopeToOwnTeam: boolean;
    priority: number;
  }> {
    this.logger.debug(`getPermissions for roleId: ${roleId}`);
    if (!roleId) {
      return { permissions: [], scopeToOwnTeam: false, priority: 0 };
    }
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        scopeToOwnTeam: true,
        priority: true,
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
      },
    });
    return {
      permissions: role?.permissions || [],
      scopeToOwnTeam: role?.scopeToOwnTeam ?? false,
      priority: role?.priority ?? 0,
    };
  }

  // Los roles de esta app son fijos: admin, webmaster, profesor y student
  // (ver database.service.ts). No se crean roles nuevos — el seed se encarga
  // de que esos cuatro siempre existan, con sus permisos editables desde acá.
  async createRole(_roleData: any): Promise<any> {
    throw new ForbiddenException(
      'No se pueden crear roles nuevos: los únicos roles de esta app son admin, webmaster, profesor y student',
    );
  }

  // Permisos sin los que el rol admin dejaría de poder administrar el sistema
  private static readonly ADMIN_REQUIRED_PERMISSIONS = [
    { resource: 'user', action: 'write' },
    { resource: 'config', action: 'write' },
  ];

  // Los roles fijos de la app: ni se borran ni se renombran, para que el seed
  // siempre los encuentre por su nombre exacto (si se renombrara "profesor",
  // el próximo reinicio el seed crearía otro "profesor" desde cero, dejando
  // dos roles parecidos dando vueltas).
  private static readonly FIXED_ROLES = [
    'admin',
    'webmaster',
    'profesor',
    'ayudante',
    'estudiante',
  ];

  async deleteRole(roleId: string): Promise<any> {
    this.logger.debug(`deleteRole with roleId: ${roleId}`);
    if (!roleId) {
      throw new Error('Role ID is required');
    }
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (RolesService.FIXED_ROLES.includes(role.name)) {
      throw new ForbiddenException(`The "${role.name}" role cannot be deleted`);
    }
    const assigned = await this.prisma.user.count({ where: { roleId } });
    if (assigned > 0) {
      throw new ConflictException(
        `The role is assigned to ${assigned} user(s); reassign them first`,
      );
    }
    return this.prisma.role.delete({
      where: { id: roleId },
    });
  }

  async updateRole(roleId: string, roleData: any): Promise<any> {
    //this.logger.debug(`updateRole with roleId: ${roleId} and data: ${JSON.stringify(roleData)}`);
    if (!roleId) {
      throw new Error('Role ID is required');
    }
    // sin esta comprobación un body sin permissions borraba todos los del rol
    // (deleteMany + create de una lista vacía) o fallaba a medias
    if (!Array.isArray(roleData?.permissions)) {
      throw new BadRequestException('permissions must be an array');
    }
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (
      RolesService.FIXED_ROLES.includes(role.name) &&
      roleData.name !== undefined &&
      roleData.name !== role.name
    ) {
      throw new ForbiddenException(`The "${role.name}" role cannot be renamed`);
    }
    if (role.name === 'admin') {
      const keeps = RolesService.ADMIN_REQUIRED_PERMISSIONS.every((required) =>
        roleData.permissions.some(
          (p: any) =>
            p.resource === required.resource && p.action === required.action,
        ),
      );
      if (!keeps) {
        throw new ForbiddenException(
          'The admin role must keep the user:write and config:write permissions',
        );
      }
      if (roleData.scopeToOwnTeam) {
        throw new ForbiddenException(
          'The admin role cannot be scoped to a team',
        );
      }
      if (
        roleData.priority !== undefined &&
        roleData.priority < role.priority
      ) {
        throw new ForbiddenException(
          'The admin role priority cannot be lowered',
        );
      }
    }
    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: roleData.name,
        description: roleData.description,
        scopeToOwnTeam: roleData.scopeToOwnTeam ?? false,
        priority: roleData.priority ?? 0,
        permissions: {
          deleteMany: {},
          create: roleData.permissions.map((p: any) => ({
            resource: p.resource,
            action: p.action,
          })),
        },
      },
      include: {
        permissions: true,
      },
    });
  }
}
