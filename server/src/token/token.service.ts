import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, User as PrismaUser } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';

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
  ): Promise<{
    name: string;
    token: string;
    expiresAt: string;
  }> {
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
    if (!user) {
      throw new Error('User not found');
    }

    const role = user.role?.name || 'guest';
    const userGroups = user.userGroups || [];
    const permissions = await this.rolesService.getPermissions(user.role?.id);
    const permissionStrings = permissions.map(
      (p: any) => `${p.resource}:${p.action}`,
    );

    //create a new JWT Token
    const token = await this.authService.generateToken(
      userId,
      user.username,
      role,
      userGroups.map((group: any) => group.name),
      permissionStrings,
      expiresAt,
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
    await this.prisma.token.create({
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

    return {
      name: name,
      token: token,
      expiresAt: expiresAt,
    };
  }

  async delete(id: string): Promise<any> {
    return this.prisma.token.delete({
      where: { id },
    });
  }
}
