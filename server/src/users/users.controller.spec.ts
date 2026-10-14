import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let users: {
    create: jest.Mock;
    delete: jest.Mock;
    findByUsername: jest.Mock;
    findById: jest.Mock;
    updatePassword: jest.Mock;
  };

  beforeEach(async () => {
    users = {
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
    it('passes the caller scope so a scoped role cannot reset another team password', async () => {
      const scopedReq = {
        user: { userId: 'u1', userGroups: ['Taller1'], scopeToOwnTeam: true },
      };
      await controller.updateUserPassword(
        'u2',
        { password: 'newpass' } as any,
        scopedReq,
      );
      expect(users.updatePassword).toHaveBeenCalledWith(
        'u2',
        'newpass',
        ['Taller1'],
        true,
      );
    });
  });
});
