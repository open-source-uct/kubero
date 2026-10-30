import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let users: {
    findAll: jest.Mock;
    updateMyProfile: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findByUsername: jest.Mock;
    findById: jest.Mock;
    updatePassword: jest.Mock;
  };

  beforeEach(async () => {
    users = {
      findAll: jest.fn(),
      updateMyProfile: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findByUsername: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: users }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const req = {
    user: { userId: 'u1', userGroups: ['everyone'], scopeToOwnTeam: false },
  };

  describe('createUser', () => {
    it('returns the created user', async () => {
      users.create.mockResolvedValue({ id: 'u1' });
      await expect(
        controller.createUser({ username: 'ana' } as any, req),
      ).resolves.toEqual({ id: 'u1' });
    });

    it('answers 400 with the reason when it fails (for example a team that no longer exists)', async () => {
      // antes el try/catch no capturaba nada (faltaba el await) y la pantalla
      // recibía un 500 genérico
      users.create.mockRejectedValue(new Error('team not found'));
      const error = await controller
        .createUser({ username: 'ana' } as any, req)
        .catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(400);
      expect(error.message).toContain('team not found');
    });
  });

  describe('deleteUser', () => {
    it('passes the acting user so nobody can delete their own account', async () => {
      await controller.deleteUser('u2', req);
      expect(users.delete).toHaveBeenCalledWith(
        'u2',
        'u1',
        ['everyone'],
        false,
      );
    });
  });

  describe('datos privados de los compañeros de equipo', () => {
    const profesor = {
      id: 'p1',
      username: 'profe',
      firstName: 'Ignacio',
      email: 'profe@uct.cl',
      lastIp: '10.0.0.5',
      lastLogin: new Date(),
      provider: 'local',
      providerId: null,
      providerData: null,
      tokens: [{ id: 't1' }],
      role: { name: 'profesor' },
      userGroups: [{ name: 'grupo10' }],
    };
    const yo = { ...profesor, id: 'e1', username: 'alumno', email: 'a@uct.cl' };
    const estudiante = {
      user: {
        userId: 'e1',
        userGroups: ['grupo10'],
        scopeToOwnTeam: true,
        permissions: ['user:read', 'app:write'],
      },
    };
    const docente = {
      user: { ...estudiante.user, userId: 'p1', permissions: ['user:write'] },
    };
    const hidden = [
      'email',
      'lastIp',
      'lastLogin',
      'provider',
      'providerId',
      'providerData',
      'tokens',
    ];

    it('hides email, IP, provider and tokens of teammates from a role without user:write', async () => {
      users.findAll.mockResolvedValue([profesor, yo]);
      const [other, own] = await controller.getPipelines(estudiante);
      for (const field of hidden) expect(other).not.toHaveProperty(field);
      expect(other).toMatchObject({
        id: 'p1',
        username: 'profe',
        firstName: 'Ignacio',
        role: { name: 'profesor' },
      });
      // los datos propios se ven completos
      expect(own.email).toBe('a@uct.cl');
    });

    it('applies the same rule when looking up one user', async () => {
      users.findById.mockResolvedValue(profesor);
      users.findByUsername.mockResolvedValue(profesor);
      const byId = await controller.getUserById('p1', estudiante);
      const byName = await controller.getUserByUsername('profe', estudiante);
      expect(byId).not.toHaveProperty('email');
      expect(byName).not.toHaveProperty('email');
    });

    it('keeps everything for a role that manages users', async () => {
      users.findAll.mockResolvedValue([yo]);
      const [other] = await controller.getPipelines(docente);
      expect(other.email).toBe('a@uct.cl');
      expect(other.lastIp).toBe('10.0.0.5');
    });

    it('returns null as is when the user does not exist', async () => {
      users.findById.mockResolvedValue(null);
      await expect(controller.getUserById('x', estudiante)).resolves.toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('sends the own profile (with the current password) to the checked update', async () => {
      const body = { email: 'nuevo@uct.cl', currentPassword: 'secreto' };
      await controller.updateProfile(req, body);
      expect(users.updateMyProfile).toHaveBeenCalledWith('u1', body);
    });
  });

  describe('getUserByUsername', () => {
    it('passes the caller scope so a scoped role cannot look up another team', async () => {
      const scopedReq = {
        user: { userId: 'u1', userGroups: ['Taller1'], scopeToOwnTeam: true },
      };
      await controller.getUserByUsername('ana', scopedReq);
      expect(users.findByUsername).toHaveBeenCalledWith(
        'ana',
        ['Taller1'],
        true,
      );
    });
  });

  describe('getUserById', () => {
    it('passes the caller scope so a scoped role cannot look up another team', async () => {
      const scopedReq = {
        user: { userId: 'u1', userGroups: ['Taller1'], scopeToOwnTeam: true },
      };
      await controller.getUserById('u2', scopedReq);
      expect(users.findById).toHaveBeenCalledWith('u2', ['Taller1'], true);
    });
  });

  describe('updateUserPassword', () => {
    it('passes the authenticated caller scope and priority for password authorization', async () => {
      const scopedReq = {
        user: {
          userId: 'u1',
          userGroups: ['Taller1'],
          scopeToOwnTeam: true,
          priority: 50,
        },
      };
      await controller.updateUserPassword(
        'u2',
        { password: 'newpass', priority: 100, scopeToOwnTeam: false } as any,
        scopedReq,
      );
      expect(users.updatePassword).toHaveBeenCalledWith(
        'u2',
        'newpass',
        ['Taller1'],
        true,
        50,
      );
    });
  });
});
