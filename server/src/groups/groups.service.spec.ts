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
    const result = await service.findAll();
    expect(result).toBe(mockGroups);
    expect(prismaMock.userGroup.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        description: true,
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

  it('deletes and renames any other team', async () => {
    prisma.userGroup.findUnique.mockResolvedValue({ id: 'g', name: 'Taller1' });
    await service.delete('g');
    await service.update('g', { name: 'Taller 1' });
    expect(prisma.userGroup.delete).toHaveBeenCalled();
    expect(prisma.userGroup.update).toHaveBeenCalled();
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
