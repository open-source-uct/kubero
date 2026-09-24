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
        delete: jest.fn().mockResolvedValue({ id: 'r' }),
        update: jest.fn().mockResolvedValue({ id: 'r' }),
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
  });
});
