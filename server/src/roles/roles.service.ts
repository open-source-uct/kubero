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

  async findAll(): Promise<any[]> {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
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

  async getPermissions(roleId: string | null | undefined): Promise<any[]> {
    this.logger.debug(`getPermissions for roleId: ${roleId}`);
    if (!roleId) {
      return [];
    }
    return this.prisma.role
      .findUnique({
        where: { id: roleId },
        select: {
          permissions: {
            select: {
              id: true,
              resource: true,
              action: true,
            },
          },
        },
      })
      .then((role) => role?.permissions || []);
  }

  async createRole(roleData: any): Promise<any> {
    //this.logger.debug(`createRole with data: ${JSON.stringify(roleData)}`);
    return this.prisma.role.create({
      data: {
        name: roleData.name,
        description: roleData.description,
        permissions: {
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

  // Permisos sin los que el rol admin dejaría de poder administrar el sistema
  private static readonly ADMIN_REQUIRED_PERMISSIONS = [
    { resource: 'user', action: 'write' },
    { resource: 'config', action: 'write' },
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
    if (role.name === 'admin') {
      throw new ForbiddenException('The admin role cannot be deleted');
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
    if (role.name === 'admin') {
      if (roleData.name !== undefined && roleData.name !== 'admin') {
        throw new ForbiddenException('The admin role cannot be renamed');
      }
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
    }
    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: roleData.name,
        description: roleData.description,
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
