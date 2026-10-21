import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaClient, User as PrismaUser } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { MailService } from '../mail/mail.service';
import { assertSafeUrl, safeAxiosOptions } from '../common/utils/ssrf.util';

// This should be a real class/interface representing a user entity
export type User = any;
export type PartialPrismaUser = Partial<PrismaUser>; // Partial type for Prisma User to remove sensitive fields

@Injectable()
export class UsersService {
  private readonly prisma = new PrismaClient();
  private logger = new Logger(UsersService.name);

  constructor(private readonly mailService: MailService) {}

  async findOne(username: string): Promise<PrismaUser | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  // Fila del token personal (para comprobar que no fue revocado)
  async findToken(id: string) {
    return this.prisma.token.findUnique({ where: { id } });
  }

  async findOneFull(username: string): Promise<PartialPrismaUser | null> {
    return this.prisma.user.findUnique({
      where: {
        username,
      },
      include: {
        tokens: {
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        userGroups: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  // Required for OAuth2 login
  async findOneOrCreate(
    username: string,
    email: string,
    provider: string,
    image: string,
  ): Promise<PartialPrismaUser> {
    let user = await this.findOneFull(username);
    if (!user) {
      this.logger.debug(
        `Oauth2 User ${username} not found, creating new user.`,
      );

      // Define default role
      const role = await this.prisma.role.findFirst({
        where: {
          name: process.env.DEFAULT_USER_ROLE || 'guest', // Default role if not specified
        },
      });
      if (!role) {
        this.logger.warn(
          `Default role not found: ${process.env.DEFAULT_USER_ROLE || 'guest'}`,
        );
        throw new Error(
          `Default role not found: ${process.env.DEFAULT_USER_ROLE || 'guest'}`,
        );
      }

      // Define default user group
      const defaultUserGroup = process.env.DEFAULT_USER_GROUP || 'everyone';
      const userGroupsData = await this.prisma.userGroup.findFirst({
        where: {
          name: defaultUserGroup,
        },
      });
      if (!userGroupsData) {
        this.logger.warn(`Default user group not found: ${defaultUserGroup}`);
        throw new Error(`Default user group not found: ${defaultUserGroup}`);
      }

      // Contraseña aleatoria que nadie conoce (el usuario entra por OAuth).
      // Antes eran 8 caracteres de Math.random(), adivinables por fuerza bruta.
      const password = crypto.randomBytes(24).toString('hex');
      const imageData = image
        ? await this.generateUserDataFromImageUrl(image)
        : null;

      user = await this.create({
        username,
        password,
        email,
        provider,
        image: imageData,
        role: role.id,
        userGroups: [userGroupsData.id],
        providerId: null, // Set providerId if needed
        providerData: null, // Set providerData if needed
      });
      this.logger.debug(`User ${username} created successfully.`);
    } else {
      // Sin esto, una cuenta OAuth cuyo nombre coincida con el de un usuario
      // local (por ejemplo "admin") entraba como ese usuario y con su rol.
      if (user.provider && user.provider !== provider) {
        this.logger.warn(
          `Refused ${provider} login: username ${username} belongs to a ${user.provider} account.`,
        );
        throw new ForbiddenException(
          'This username is already used by another account',
        );
      }
      this.logger.debug(`User ${username} found.`);
    }
    return user;
  }

  async findById(
    userId: string,
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
  ): Promise<PartialPrismaUser | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        lastLogin: true,
        lastIp: true,
        provider: true,
        providerId: true,
        providerData: true,
        image: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        userGroups: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
    if (
      user &&
      scopeToOwnTeam &&
      !user.userGroups.some((g) => callerGroups.includes(g.name))
    ) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }
    return user;
  }

  async findAll(
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
  ): Promise<User[]> {
    return this.prisma.user.findMany({
      where: scopeToOwnTeam
        ? { userGroups: { some: { name: { in: callerGroups } } } }
        : undefined,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        lastLogin: true,
        lastIp: true,
        provider: true,
        providerId: true,
        providerData: true,
        image: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        userGroups: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        tokens: {
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });
  }

  async findByUsername(
    username: string,
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
  ): Promise<PartialPrismaUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        lastLogin: true,
        lastIp: true,
        provider: true,
        providerId: true,
        providerData: true,
        image: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        userGroups: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
    if (
      user &&
      scopeToOwnTeam &&
      !user.userGroups.some((g) => callerGroups.includes(g.name))
    ) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }
    return user;
  }

  // Un rol acotado a equipo propio (Role.scopeToOwnTeam) solo puede gestionar
  // usuarios de sus propios equipos, y solo puede asignarles equipos propios y
  // roles que también estén acotados (si no, podría crear un usuario con un
  // rol global y saltarse el acotamiento).
  private async restrictGroupIdsToCallerTeams(
    groupIds: any[],
    callerGroups: string[],
  ): Promise<string[]> {
    const ids = (groupIds || []).map((g: any) =>
      typeof g === 'string' ? g : g.id,
    );
    if (ids.length === 0) {
      return [];
    }
    const groups = await this.prisma.userGroup.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const allowed = groups
      .filter((g) => callerGroups.includes(g.name))
      .map((g) => g.id);
    if (allowed.length === 0) {
      throw new ForbiddenException(
        'No puedes asignar equipos fuera de los tuyos',
      );
    }
    return allowed;
  }

  // Un rol acotado solo puede asignar roles cuya priority sea menor o igual a
  // la suya propia (admin=100, profesor/webmaster=50, student=10, por
  // ejemplo) — así no hace falta inferir "peligro" a partir de combinaciones
  // de permisos.
  private async assertAssignableRole(
    roleId: string,
    callerPriority: number,
  ): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { priority: true, scopeToOwnTeam: true },
    });
    if (!role) {
      throw new ForbiddenException('El rol no existe');
    }
    // la prioridad sola no alcanza: un rol sin acotar (ej. member, guest, con
    // priority 0 por defecto) dejaría a quien lo reciba viendo todo el
    // sistema, sin importar qué tan "baja" sea su prioridad numérica
    if (!role.scopeToOwnTeam) {
      throw new ForbiddenException(
        'No puedes asignar un rol que no esté acotado a un equipo',
      );
    }
    if (role.priority > callerPriority) {
      throw new ForbiddenException(
        'No puedes asignar un rol con mayor prioridad que el tuyo',
      );
    }
  }

  private async assertSharesTeam(
    userId: string,
    callerGroups: string[],
  ): Promise<{ roleId: string | null } | undefined> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true, userGroups: { select: { name: true } } },
    });
    if (!target) {
      return;
    }
    const shares = target.userGroups.some((g) => callerGroups.includes(g.name));
    if (!shares) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }
    return target;
  }

  async create(
    user: any,
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
    callerPriority = 0,
  ): Promise<PartialPrismaUser> {
    //this.logger.debug('Creating user with data:', user);
    const { role, userGroups } = user;
    let resolvedUserGroups = userGroups;
    if (scopeToOwnTeam) {
      if (role) {
        await this.assertAssignableRole(role, callerPriority);
      }
      resolvedUserGroups = await this.restrictGroupIdsToCallerTeams(
        userGroups,
        callerGroups,
      );
      // un usuario recién creado no tiene ningún otro equipo todavía: si
      // queda sin ninguno, le queda invisible al que lo acaba de crear (y a
      // cualquier otro acotado) desde el día uno — solo admin podría
      // encontrarlo después
      if (resolvedUserGroups.length === 0) {
        throw new ForbiddenException(
          'Debes asignarle al menos un equipo propio al usuario nuevo',
        );
      }
    }
    // Lista explicita: evita que el body inyecte campos como roleId, twoFaSecret o id
    const CREATABLE_FIELDS = [
      'username',
      'email',
      'password',
      'firstName',
      'lastName',
      'image',
      'isActive',
      'provider',
      'providerId',
      'providerData',
    ];
    const cleanedData = Object.fromEntries(
      Object.entries(user).filter(([key]) => CREATABLE_FIELDS.includes(key)),
    ) as Pick<PrismaUser, 'username' | 'email' | 'password'> &
      Partial<Omit<PrismaUser, 'id' | 'roleId'>>;

    if (
      cleanedData.password &&
      typeof cleanedData.password === 'string' &&
      cleanedData.password.length > 0
    ) {
      cleanedData.password = bcrypt.hashSync(cleanedData.password, 10);
    } else {
      // If no password is provided, throw an error or handle accordingly
      this.logger.warn('Password is required for user creation.');
      throw new Error('Password is required for user creation.');
    }

    return this.prisma.user.create({
      omit: {
        password: true,
        twoFaSecret: true,
      },
      data: {
        ...cleanedData,
        role: role && role ? { connect: { id: role } } : undefined,
        userGroups:
          resolvedUserGroups && Array.isArray(resolvedUserGroups)
            ? {
                connect: resolvedUserGroups.map((g: any) => ({
                  id: g.id || g,
                })),
              }
            : undefined,
      },
    });
  }

  async update(
    userId: string,
    user: any,
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
    callerPriority = 0,
  ): Promise<PartialPrismaUser | undefined> {
    if (scopeToOwnTeam) {
      await this.assertSharesTeam(userId, callerGroups);
    }
    const { role, userGroups } = user;
    // Lista explícita, igual que en create(): con un "...resto" del body,
    // campos como roleId llegaban directo a Prisma y un rol acotado podía
    // darse otro rol saltándose assertAssignableRole (o tocar twoFaSecret).
    const UPDATABLE_FIELDS = [
      'username',
      'email',
      'firstName',
      'lastName',
      'isActive',
    ];
    const data: any = Object.fromEntries(
      Object.entries(user).filter(([key]) => UPDATABLE_FIELDS.includes(key)),
    );

    // no dejar el sistema sin administrador: desactivar al último o cambiarle
    // el rol a uno que no sea admin
    if (data.isActive === false) {
      await this.assertAnotherAdminRemains(userId);
    }
    if (role && typeof role === 'string') {
      const newRole = await this.prisma.role.findUnique({
        where: { id: role },
        select: { name: true },
      });
      if (newRole && newRole.name !== 'admin') {
        await this.assertAnotherAdminRemains(userId);
      }
    }

    if (scopeToOwnTeam && role && typeof role === 'string') {
      await this.assertAssignableRole(role, callerPriority);
    }

    // fix relations
    if (role && typeof role === 'string') {
      data.role = { connect: { id: role } };
    }
    if (userGroups && Array.isArray(userGroups)) {
      if (scopeToOwnTeam) {
        const resolvedUserGroups = await this.restrictGroupIdsToCallerTeams(
          userGroups,
          callerGroups,
        );
        // nunca un "set" completo acá: un rol acotado no debe poder tocar
        // (ni borrar sin querer) la membresía del usuario en equipos fuera de
        // su propio alcance, así que solo se desconectan/conectan sus
        // propios equipos, dejando el resto intacto
        const ownGroups = await this.prisma.userGroup.findMany({
          where: { name: { in: callerGroups } },
          select: { id: true },
        });
        data.userGroups = {
          disconnect: ownGroups
            .filter((g) => !resolvedUserGroups.includes(g.id))
            .map((g) => ({ id: g.id })),
          connect: resolvedUserGroups.map((id) => ({ id })),
        };
      } else {
        data.userGroups = {
          set: [],
          connect: userGroups.map((g: any) => ({ id: g.id || g })),
        };
      }
    }

    if (Object.keys(data).length === 0) {
      this.logger.warn(
        `No valid fields provided for update on user with ID ${userId}.`,
      );
      return undefined;
    }

    try {
      return await this.prisma.user.update({
        omit: {
          password: true,
          twoFaSecret: true,
        },
        where: { id: userId },
        data,
      });
    } catch (error) {
      this.logger.warn(`User with ID ${userId} not updated.`);
      this.logger.debug(error);
      return undefined;
    }
  }

  async updatePassword(
    userId: string,
    newPassword: string,
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
    callerPriority = 0,
  ): Promise<PartialPrismaUser | undefined> {
    if (
      !newPassword ||
      typeof newPassword !== 'string' ||
      newPassword.length === 0
    ) {
      this.logger.warn('No valid new password provided for password update.');
      return undefined;
    }
    if (scopeToOwnTeam) {
      const target = await this.assertSharesTeam(userId, callerGroups);
      if (!target) {
        return undefined;
      }
      if (!target.roleId) {
        throw new ForbiddenException('El usuario no tiene un rol asignado');
      }
      // Compartir equipo no autoriza a restablecer roles globales o superiores.
      await this.assertAssignableRole(target.roleId, callerPriority);
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const user = await this.prisma.user.update({
        omit: { password: true, twoFaSecret: true },
        where: { id: userId },
        data: { password: hashedPassword },
      });
      this.logger.debug(`Password updated for user with ID ${userId}.`);
      void this.mailService.sendPasswordChangedEmail(user.email, user.username);
      return user;
    } catch (error) {
      this.logger.debug(
        `Error updating password for user with ID ${userId}:`,
        error,
      );
      this.logger.warn(`User with ID ${userId} not found for password update.`);
      return undefined;
    }
  }

  async updateMyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<PartialPrismaUser | undefined> {
    if (
      !currentPassword ||
      !newPassword ||
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8
    ) {
      this.logger.warn(
        'Invalid current or new password provided for password update.',
      );
      return undefined;
    }

    try {
      // First, get the user with their current password
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });

      if (!user) {
        this.logger.warn(
          `User with ID ${userId} not found for password update.`,
        );
        return undefined;
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        this.logger.warn(
          `Invalid current password provided for user ${userId}.`,
        );
        //throw new Error('Current password is incorrect');
        throw new HttpException(
          `Error updating password: Current password is incorrect`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Hash and update new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await this.prisma.user.update({
        omit: { password: true, twoFaSecret: true },
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      this.logger.debug(`Password updated for user with ID ${userId}.`);
      void this.mailService.sendPasswordChangedEmail(
        updatedUser.email,
        updatedUser.username,
      );
      return updatedUser;
    } catch (error) {
      this.logger.debug(
        `Error updating password for user with ID ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // Impide dejar el sistema sin ningún administrador activo (borrar, desactivar
  // o cambiar de rol al último).
  private async assertAnotherAdminRemains(userId: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, role: { select: { name: true } } },
    });
    if (!target || target.role?.name !== 'admin' || target.isActive === false) {
      return;
    }
    const others = await this.prisma.user.count({
      where: { id: { not: userId }, isActive: true, role: { name: 'admin' } },
    });
    if (others === 0) {
      throw new ConflictException('This is the last active administrator');
    }
  }

  async delete(
    userId: string,
    actingUserId?: string,
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
  ): Promise<void> {
    if (actingUserId && actingUserId === userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    if (scopeToOwnTeam) {
      await this.assertSharesTeam(userId, callerGroups);
    }
    await this.assertAnotherAdminRemains(userId);
    try {
      await this.prisma.user.delete({ where: { id: userId } });
    } catch {
      this.logger.warn(`User with ID ${userId} not found for deletion.`);
    }
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  async exists(username: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    return !!user;
  }

  async listUsersByGroup(groupId: string): Promise<PrismaUser[]> {
    return this.prisma.user.findMany({
      where: {
        userGroups: {
          some: {
            id: groupId,
          },
        },
      },
    });
  }

  async findAllRoles(): Promise<any[]> {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateAvatar(
    userId: string,
    avatarFile: any,
  ): Promise<Omit<PrismaUser, 'password' | 'twoFaSecret'> | undefined> {
    if (!avatarFile || !avatarFile.buffer) {
      this.logger.warn('No avatar file buffer provided.');
      return undefined;
    }
    // Store as base64 string in DB (for demo; in production, store in object storage or filesystem)
    const base64Image = `data:${avatarFile.mimetype};base64,${avatarFile.buffer.toString('base64')}`;
    try {
      return await this.prisma.user.update({
        omit: { password: true, twoFaSecret: true },
        where: { id: userId },
        data: { image: base64Image },
      });
    } catch (error) {
      this.logger.warn(`User with ID ${userId} not found for avatar update.`);
      this.logger.debug(error);
      return undefined;
    }
  }

  async getAvatar(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    return user ? user.image : null;
  }

  private async generateUserDataFromImageUrl(
    imageUrl: string,
  ): Promise<string> {
    assertSafeUrl(imageUrl);
    const response = await axios.get(imageUrl, {
      ...safeAxiosOptions(),
      responseType: 'arraybuffer',
      // El agente seguro debe resolver el destino, no un proxy del entorno.
      proxy: false,
    });
    if (response.status !== 200) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
    }
    const mimetype = response.headers['content-type'] || 'image/jpeg'; // Default to jpeg if not specified
    if (!mimetype.startsWith('image/')) {
      throw new Error(`Invalid image MIME type: ${mimetype}`);
    }

    const buffer = Buffer.from(response.data, 'binary');
    const base64Image = buffer.toString('base64');
    return `data:${mimetype};base64,${base64Image}`;
  }
  /*
  async getPermissions(userId: string,): Promise<{ action: string; resource: string }[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                action: true,
                resource: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.role || !user.role.permissions) {
      return [];
    }

    return user.role.permissions.map((p) => ({
      action: p.action,
      resource: p.resource,
    }));
  }
*/
}
