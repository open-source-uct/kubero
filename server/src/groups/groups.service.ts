import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class GroupsService {
  private readonly prisma = new PrismaClient();
  private logger = new Logger(GroupsService.name);

  constructor() {}
  async findAll(): Promise<any[]> {
    return this.prisma.userGroup.findMany({
      select: {
        id: true,
        name: true,
        description: true,
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
    return clean;
  }

  async create(name: string, description: string): Promise<any> {
    const groupData = {
      name: this.cleanName(name),
      description,
    };
    return this.prisma.userGroup.create({
      data: groupData,
    });
  }

  async findById(id: string): Promise<any> {
    return this.prisma.userGroup.findUnique({
      where: { id },
    });
  }

  // Equipos que el sistema usa por nombre: 'admin' da acceso a todos los
  // pipelines y 'everyone' es el equipo por defecto de los usuarios nuevos.
  private static readonly PROTECTED = ['admin', 'everyone'];

  private async assertNotProtected(id: string, action: string) {
    const group = await this.prisma.userGroup.findUnique({ where: { id } });
    if (group && GroupsService.PROTECTED.includes(group.name)) {
      throw new ForbiddenException(
        `The "${group.name}" team cannot be ${action}`,
      );
    }
  }

  async update(id: string, groupData: any): Promise<any> {
    // renombrar 'admin' dejaría a todos sus miembros sin el acceso total
    if (groupData?.name !== undefined) {
      await this.assertNotProtected(id, 'renamed');
      groupData = { ...groupData, name: this.cleanName(groupData.name) };
    }
    return this.prisma.userGroup.update({
      where: { id },
      data: groupData,
    });
  }

  async delete(id: string): Promise<any> {
    await this.assertNotProtected(id, 'deleted');
    return this.prisma.userGroup.delete({
      where: { id },
    });
  }
}
