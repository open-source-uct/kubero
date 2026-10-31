import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  isReservedTeamName,
  isSupervisedRole,
  PERSONAL_TEAM_PREFIX,
} from './personal-team';

@Injectable()
export class GroupsService {
  private readonly prisma = new PrismaClient();
  private logger = new Logger(GroupsService.name);

  constructor() {}
  // Los equipos personales de los demás no se listan (ni a admin): hay uno por
  // usuario y no se asignan a nadie.
  async findAll(
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
    callerUserId?: string,
  ): Promise<any[]> {
    return this.prisma.userGroup.findMany({
      where: scopeToOwnTeam
        ? { name: { in: callerGroups } }
        : { OR: [{ ownerId: null }, { ownerId: callerUserId ?? null }] },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Los equipos se comparan por nombre exacto con el `access.teams` de los
  // pipelines. Un espacio al final ("Taller1 ") dejaba a sus miembros sin ver
  // los pipelines del equipo "Taller1" sin ningún error visible.
  private cleanName(name: string): string {
    const clean = typeof name === 'string' ? name.trim() : '';
    if (!clean) {
      throw new BadRequestException('The team name cannot be empty');
    }
    if (isReservedTeamName(clean)) {
      throw new BadRequestException(
        `Team names starting with "${PERSONAL_TEAM_PREFIX}" are reserved for personal teams`,
      );
    }
    return clean;
  }

  async create(
    name: string,
    description: string,
    callerUserId?: string,
    scopeToOwnTeam = false,
    callerRole?: string,
  ): Promise<any> {
    // un equipo creado por un ayudante, sin el profesor, sería un lugar donde
    // dejar pipelines que el profesor no ve
    if (isSupervisedRole(callerRole)) {
      throw new ForbiddenException(
        'Tu rol no puede crear equipos: pídeselo a tu profesor',
      );
    }
    const groupData = {
      name: this.cleanName(name),
      description,
    };
    return this.prisma.userGroup.create({
      data: {
        ...groupData,
        // un rol acotado que crea un equipo nuevo no pertenece a él todavía;
        // sin esto, el equipo que acaba de crear le quedaría invisible
        users:
          scopeToOwnTeam && callerUserId
            ? { connect: { id: callerUserId } }
            : undefined,
      },
    });
  }

  async findById(id: string): Promise<any> {
    return this.prisma.userGroup.findUnique({
      where: { id },
    });
  }

  // Equipos que el sistema usa por nombre: 'admin' da acceso a todos los
  // pipelines y 'everyone' es el equipo por defecto de los usuarios nuevos.
  // Los equipos personales tampoco se renombran ni se borran: existen
  // mientras exista su dueño.
  private static readonly PROTECTED = ['admin', 'everyone'];

  // newName: si se pasa, solo se bloquea cuando el nombre realmente cambia. El
  // formulario siempre reenvía el nombre, y sin esto no se podía editar ni la
  // descripción de los equipos protegidos.
  private async assertNotProtected(
    id: string,
    action: string,
    newName?: string,
  ) {
    const group = await this.prisma.userGroup.findUnique({ where: { id } });
    if (
      group &&
      (GroupsService.PROTECTED.includes(group.name) || group.ownerId) &&
      (newName === undefined || newName !== group.name)
    ) {
      throw new ForbiddenException(
        `The "${group.name}" team cannot be ${action}`,
      );
    }
  }

  // Un rol acotado a equipo propio solo puede tocar equipos a los que él
  // mismo pertenece (crear uno nuevo sí se permite, eso no expone nada de
  // otros equipos).
  private async assertOwnTeam(id: string, callerGroups: string[]) {
    const group = await this.prisma.userGroup.findUnique({ where: { id } });
    if (group && !callerGroups.includes(group.name)) {
      throw new ForbiddenException('No tienes acceso a este equipo');
    }
  }

  // Un ayudante no puede borrar ni renombrar el equipo del profesor: un rol
  // acotado solo lo hace si nadie del equipo tiene un rol acotado superior al
  // suyo. Renombrar también cuenta, porque los pipelines guardan el nombre.
  private async assertNoHigherMember(
    id: string,
    callerPriority: number,
    newName?: string,
  ) {
    const group = await this.prisma.userGroup.findUnique({ where: { id } });
    if (!group || (newName !== undefined && newName === group.name)) {
      return;
    }
    const higher = await this.prisma.user.count({
      where: {
        userGroups: { some: { id } },
        role: { scopeToOwnTeam: true, priority: { gt: callerPriority } },
      },
    });
    if (higher > 0) {
      throw new ForbiddenException(
        'Este equipo tiene integrantes con un rol superior al tuyo',
      );
    }
  }

  async update(
    id: string,
    groupData: { name?: string; description?: string },
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
    callerPriority = 0,
  ): Promise<any> {
    if (scopeToOwnTeam) {
      await this.assertOwnTeam(id, callerGroups);
    }
    // Solo name y description: el ValidationPipe global no descarta campos
    // extra, y pasar el body entero a Prisma permitía operaciones anidadas
    // sobre `users` (cambiar roles o contraseñas, sumar miembros de otros
    // equipos) sin pasar por los controles de UsersService.
    const data: { name?: string; description?: string } = {};
    // renombrar 'admin' dejaría a todos sus miembros sin el acceso total
    if (groupData?.name !== undefined) {
      // el formulario reenvía el nombre: solo se valida si cambia (el de un
      // equipo personal ya usa el prefijo reservado)
      const current = await this.findById(id);
      data.name =
        current && groupData.name === current.name
          ? current.name
          : this.cleanName(groupData.name);
      await this.assertNotProtected(id, 'renamed', data.name);
      if (scopeToOwnTeam) {
        await this.assertNoHigherMember(id, callerPriority, data.name);
      }
    }
    if (groupData?.description !== undefined) {
      data.description = groupData.description;
    }
    return this.prisma.userGroup.update({
      where: { id },
      data,
    });
  }

  async delete(
    id: string,
    callerGroups: string[] = [],
    scopeToOwnTeam = false,
    callerPriority = 0,
  ): Promise<any> {
    if (scopeToOwnTeam) {
      await this.assertOwnTeam(id, callerGroups);
    }
    await this.assertNotProtected(id, 'deleted');
    if (scopeToOwnTeam) {
      await this.assertNoHigherMember(id, callerPriority);
    }
    return this.prisma.userGroup.delete({
      where: { id },
    });
  }
}
