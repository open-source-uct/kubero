import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesService],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('RolesService protections', () => {
  let service: RolesService;
  let prisma: any;

  const withPermissions = (...pairs: string[]) =>
    pairs.map((p) => {
      const [resource, action] = p.split(':');
      return { resource, action };
    });

  beforeEach(() => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({ id: 'r' }),
        update: jest.fn().mockResolvedValue({ id: 'r' }),
        create: jest.fn().mockResolvedValue({ id: 'r' }),
      },
      user: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new RolesService();
    // @ts-expect-error prisma es privado; se reemplaza por un mock
    service['prisma'] = prisma;
  });

  describe('deleteRole', () => {
    it('refuses to delete the admin role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'admin' });
      await expect(service.deleteRole('r')).rejects.toThrow(ForbiddenException);
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete a role that still has users', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'student' });
      prisma.user.count.mockResolvedValue(3);
      await expect(service.deleteRole('r')).rejects.toThrow(ConflictException);
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('deletes an unused custom role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'student' });
      await service.deleteRole('r');
      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'r' } });
    });

    it('reports a role that does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.deleteRole('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRole', () => {
    it('rejects a body without a permissions array instead of wiping the role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'student' });
      await expect(
        service.updateRole('r', { name: 'student' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('refuses to rename the admin role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'admin' });
      await expect(
        service.updateRole('r', {
          name: 'root',
          permissions: withPermissions('user:write', 'config:write'),
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to strip user:write or config:write from the admin role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'admin' });
      await expect(
        service.updateRole('r', {
          name: 'admin',
          permissions: withPermissions('app:write', 'config:write'),
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateRole('r', {
          name: 'admin',
          permissions: withPermissions('user:write'),
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('lets the admin role change other permissions while keeping the critical ones', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'admin' });
      await service.updateRole('r', {
        name: 'admin',
        permissions: withPermissions('user:write', 'config:write', 'app:read'),
      });
      expect(prisma.role.update).toHaveBeenCalled();
    });

    it('updates any other role freely', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'student' });
      await service.updateRole('r', {
        name: 'estudiante',
        permissions: withPermissions('app:read'),
      });
      expect(prisma.role.update).toHaveBeenCalled();
    });

    it('refuses to scope the admin role to a team', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'admin' });
      await expect(
        service.updateRole('r', {
          name: 'admin',
          scopeToOwnTeam: true,
          permissions: withPermissions('user:write', 'config:write'),
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });
  });

  describe('scopeToOwnTeam', () => {
    it('createRole saves scopeToOwnTeam on the new role', async () => {
      await service.createRole({
        name: 'profesor',
        scopeToOwnTeam: true,
        permissions: withPermissions('user:write'),
      });
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scopeToOwnTeam: true }),
        }),
      );
    });

    it('createRole defaults scopeToOwnTeam to false when omitted', async () => {
      await service.createRole({
        name: 'profesor',
        permissions: withPermissions('user:write'),
      });
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scopeToOwnTeam: false }),
        }),
      );
    });

    it('updateRole saves scopeToOwnTeam on a non-admin role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r', name: 'profesor' });
      await service.updateRole('r', {
        name: 'profesor',
        scopeToOwnTeam: true,
        permissions: withPermissions('user:write'),
      });
      expect(prisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scopeToOwnTeam: true }),
        }),
      );
    });

    it('getPermissions returns the scopeToOwnTeam flag alongside permissions', async () => {
      prisma.role.findUnique.mockResolvedValue({
        scopeToOwnTeam: true,
        permissions: [{ id: 'p1', resource: 'user', action: 'write' }],
      });
      const result = await service.getPermissions('r');
      expect(result).toEqual({
        permissions: [{ id: 'p1', resource: 'user', action: 'write' }],
        scopeToOwnTeam: true,
      });
    });

    it('getPermissions defaults to not scoped for a missing role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      const result = await service.getPermissions('missing');
      expect(result).toEqual({ permissions: [], scopeToOwnTeam: false });
    });

    it('findAll returns every role when the caller is not scoped', async () => {
      await service.findAll(false);
      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('findAll only shows assignable roles when the caller is scoped', async () => {
      await service.findAll(true);
      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { scopeToOwnTeam: true },
              {
                permissions: {
                  none: {
                    OR: [
                      { resource: 'user', action: 'write' },
                      { resource: 'config', action: 'write' },
                    ],
                  },
                },
              },
            ],
          },
        }),
      );
    });
  });
});
