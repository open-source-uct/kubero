import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupsService } from './groups.service';

describe('GroupService', () => {
  let service: GroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupsService],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('GroupsService', () => {
  let service: GroupsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      userGroup: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new GroupsService();
    // @ts-expect-error prisma es privado; se reemplaza por un mock
    service['prisma'] = prismaMock;
  });

  it('should find all groups', async () => {
    const mockGroups = [{ id: '1', name: 'group1' }];
    prismaMock.userGroup.findMany.mockResolvedValueOnce(mockGroups);
    const result = await service.findAll([], false, 'u1');
    expect(result).toBe(mockGroups);
    expect(prismaMock.userGroup.findMany).toHaveBeenCalledWith({
      where: { OR: [{ ownerId: null }, { ownerId: 'u1' }] },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should create a group', async () => {
    const mockGroup = { id: '2', name: 'group2', description: 'desc' };
    prismaMock.userGroup.create.mockResolvedValueOnce(mockGroup);
    const result = await service.create('group2', 'desc');
    expect(result).toBe(mockGroup);
    expect(prismaMock.userGroup.create).toHaveBeenCalledWith({
      data: { name: 'group2', description: 'desc' },
    });
  });

  it('should find a group by id', async () => {
    const mockGroup = { id: '3', name: 'group3' };
    prismaMock.userGroup.findUnique.mockResolvedValueOnce(mockGroup);
    const result = await service.findById('3');
    expect(result).toBe(mockGroup);
    expect(prismaMock.userGroup.findUnique).toHaveBeenCalledWith({
      where: { id: '3' },
    });
  });

  it('should update a group', async () => {
    const mockGroup = { id: '4', name: 'group4', description: 'desc4' };
    prismaMock.userGroup.update.mockResolvedValueOnce(mockGroup);
    const result = await service.update('4', {
      name: 'group4',
      description: 'desc4',
    });
    expect(result).toBe(mockGroup);
    expect(prismaMock.userGroup.update).toHaveBeenCalledWith({
      where: { id: '4' },
      data: { name: 'group4', description: 'desc4' },
    });
  });

  it('should delete a group', async () => {
    const mockGroup = { id: '5', name: 'group5' };
    prismaMock.userGroup.delete.mockResolvedValueOnce(mockGroup);
    const result = await service.delete('5');
    expect(result).toBe(mockGroup);
    expect(prismaMock.userGroup.delete).toHaveBeenCalledWith({
      where: { id: '5' },
    });
  });
});

describe('GroupsService protected teams', () => {
  let service: GroupsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      userGroup: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    service = new GroupsService();
    // @ts-expect-error prisma es privado; se reemplaza por un mock
    service['prisma'] = prisma;
  });

  it.each(['admin', 'everyone'])(
    'refuses to delete the %s team',
    async (name) => {
      prisma.userGroup.findUnique.mockResolvedValue({ id: 'g', name });
      await expect(service.delete('g')).rejects.toThrow(ForbiddenException);
      expect(prisma.userGroup.delete).not.toHaveBeenCalled();
    },
  );

  it.each(['admin', 'everyone'])(
    'refuses to rename the %s team',
    async (name) => {
      prisma.userGroup.findUnique.mockResolvedValue({ id: 'g', name });
      await expect(service.update('g', { name: 'other' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.userGroup.update).not.toHaveBeenCalled();
    },
  );

  it('still lets the description of a protected team change', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({ id: 'g', name: 'admin' });
    await service.update('g', { description: 'nuevo' });
    expect(prisma.userGroup.update).toHaveBeenCalled();
  });

  it.each(['admin', 'everyone'])(
    'lets the description of the %s team change when the form resends its unchanged name',
    async (name) => {
      prisma.userGroup.findUnique.mockResolvedValue({ id: 'g', name });
      await service.update('g', { name, description: 'nuevo' });
      expect(prisma.userGroup.update).toHaveBeenCalledWith({
        where: { id: 'g' },
        data: { name, description: 'nuevo' },
      });
    },
  );

  it('deletes and renames any other team', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({ id: 'g', name: 'Taller1' });
    await service.delete('g');
    await service.update('g', { name: 'Taller 1' });
    expect(prisma.userGroup.delete).toHaveBeenCalled();
    expect(prisma.userGroup.update).toHaveBeenCalled();
  });
});

describe('GroupsService scopeToOwnTeam', () => {
  let service: GroupsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      userGroup: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new GroupsService();
    // @ts-expect-error prisma es privado; se reemplaza por un mock
    service['prisma'] = prisma;
  });

  it('findAll filters by the caller teams when scoped', async () => {
    await service.findAll(['Taller1'], true);
    expect(prisma.userGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { in: ['Taller1'] } } }),
    );
  });

  it('findAll does not filter by team when not scoped, but hides the personal teams of others', async () => {
    await service.findAll(['Taller1'], false, 'admin-id');
    expect(prisma.userGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ ownerId: null }, { ownerId: 'admin-id' }] },
      }),
    );
  });

  it('refuses to update a team the caller does not belong to', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({
      id: 'g',
      name: 'Taller2',
    });
    await expect(
      service.update('g', { description: 'x' }, ['Taller1'], true),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.userGroup.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a team the caller does not belong to', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({
      id: 'g',
      name: 'Taller2',
    });
    await expect(service.delete('g', ['Taller1'], true)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.userGroup.delete).not.toHaveBeenCalled();
  });

  it('allows updating and deleting a team the caller belongs to', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({
      id: 'g',
      name: 'Taller1',
    });
    await service.update('g', { description: 'x' }, ['Taller1'], true);
    await service.delete('g', ['Taller1'], true);
    expect(prisma.userGroup.update).toHaveBeenCalled();
    expect(prisma.userGroup.delete).toHaveBeenCalled();
  });

  it('ignores nested relations in the body (a scoped role cannot change members through a team edit)', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({
      id: 'g',
      name: 'Taller1',
    });
    await service.update(
      'g',
      {
        name: 'Taller1',
        description: 'x',
        users: {
          update: {
            where: { id: 'caller-id' },
            data: { role: { connect: { name: 'admin' } } },
          },
          connect: { id: 'other-team-user' },
        },
      } as any,
      ['Taller1'],
      true,
    );
    expect(prisma.userGroup.update).toHaveBeenCalledWith({
      where: { id: 'g' },
      data: { name: 'Taller1', description: 'x' },
    });
  });

  it('create joins the caller to the new team when scoped (otherwise it would be invisible to them)', async () => {
    prisma.userGroup.create = jest.fn().mockResolvedValue({});
    await service.create('Taller3', 'desc', 'caller-id', true);
    expect(prisma.userGroup.create).toHaveBeenCalledWith({
      data: {
        name: 'Taller3',
        description: 'desc',
        users: { connect: { id: 'caller-id' } },
      },
    });
  });

  it('create does not join the caller when not scoped', async () => {
    prisma.userGroup.create = jest.fn().mockResolvedValue({});
    await service.create('Taller3', 'desc', 'caller-id', false);
    expect(prisma.userGroup.create).toHaveBeenCalledWith({
      data: {
        name: 'Taller3',
        description: 'desc',
        users: undefined,
      },
    });
  });
});

describe('GroupsService names', () => {
  let service: GroupsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      userGroup: {
        findUnique: jest.fn().mockResolvedValue({ id: 'g', name: 'Taller1' }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new GroupsService();
    // @ts-expect-error prisma es privado; se reemplaza por un mock
    service['prisma'] = prisma;
  });

  it('trims the name of a new team ("Taller1 " != "Taller1" for pipeline access)', async () => {
    await service.create('  Taller1 ', 'desc');
    expect(prisma.userGroup.create).toHaveBeenCalledWith({
      data: { name: 'Taller1', description: 'desc' },
    });
  });

  it('trims the name when renaming a team', async () => {
    await service.update('g', { name: 'Taller 2 ' });
    expect(prisma.userGroup.update).toHaveBeenCalledWith({
      where: { id: 'g' },
      data: { name: 'Taller 2' },
    });
  });

  it('rejects an empty or blank name', async () => {
    await expect(service.create('   ', 'd')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update('g', { name: '' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.userGroup.create).not.toHaveBeenCalled();
  });
});

describe('GroupsService personal teams and hierarchy', () => {
  let service: GroupsService;
  let prisma: any;
  const personal = { id: 'p', name: 'personal-ana', ownerId: 'u-ana' };

  beforeEach(() => {
    prisma = {
      userGroup: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new GroupsService();
    // @ts-expect-error prisma es privado; se reemplaza por un mock
    service['prisma'] = prisma;
  });

  it.each(['estudiante', 'ayudante'])(
    'a %s cannot create teams (one without the profesor would hide pipelines)',
    async (role) => {
      await expect(
        service.create('Secreto', 'd', 'u1', true, role),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.userGroup.create).not.toHaveBeenCalled();
    },
  );

  it('a profesor can still create teams', async () => {
    await service.create('Taller3', 'd', 'u1', true, 'profesor');
    expect(prisma.userGroup.create).toHaveBeenCalled();
  });

  it('reserves the "personal-" prefix for personal teams', async () => {
    await expect(service.create('Personal-ana', 'd')).rejects.toThrow(
      BadRequestException,
    );
    prisma.userGroup.findUnique.mockResolvedValue({ id: 'g', name: 'Taller1' });
    await expect(service.update('g', { name: 'personal-ana' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.userGroup.create).not.toHaveBeenCalled();
    expect(prisma.userGroup.update).not.toHaveBeenCalled();
  });

  it('refuses to rename or delete a personal team, even for admin', async () => {
    prisma.userGroup.findUnique.mockResolvedValue(personal);
    await expect(service.update('p', { name: 'otro' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.delete('p')).rejects.toThrow(ForbiddenException);
    expect(prisma.userGroup.update).not.toHaveBeenCalled();
    expect(prisma.userGroup.delete).not.toHaveBeenCalled();
  });

  it('still lets the owner edit the description of their personal team', async () => {
    prisma.userGroup.findUnique.mockResolvedValue(personal);
    await service.update(
      'p',
      { name: 'personal-ana', description: 'mis pruebas' },
      ['personal-ana'],
      true,
      10,
    );
    expect(prisma.userGroup.update).toHaveBeenCalledWith({
      where: { id: 'p' },
      data: { name: 'personal-ana', description: 'mis pruebas' },
    });
  });

  it('an ayudante cannot delete or rename the team of their profesor', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({
      id: 'g',
      name: 'Taller1',
      ownerId: null,
    });
    prisma.user.count.mockResolvedValue(1); // el profesor (50) está en Taller1
    await expect(service.delete('g', ['Taller1'], true, 30)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.update('g', { name: 'Taller9' }, ['Taller1'], true, 30),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        userGroups: { some: { id: 'g' } },
        role: { scopeToOwnTeam: true, priority: { gt: 30 } },
      },
    });
    expect(prisma.userGroup.delete).not.toHaveBeenCalled();
    expect(prisma.userGroup.update).not.toHaveBeenCalled();
  });

  it('an ayudante can still edit the description of that team', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({
      id: 'g',
      name: 'Taller1',
      ownerId: null,
    });
    prisma.user.count.mockResolvedValue(1);
    await service.update(
      'g',
      { name: 'Taller1', description: 'x' },
      ['Taller1'],
      true,
      30,
    );
    expect(prisma.userGroup.update).toHaveBeenCalled();
  });
});
