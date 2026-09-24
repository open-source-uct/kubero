import { UnauthorizedException } from '@nestjs/common';
import { IdentityService } from './identity.service';

describe('IdentityService.resolve', () => {
  let usersService: { findById: jest.Mock; findToken: jest.Mock };
  let rolesService: { getPermissions: jest.Mock };
  let strategy: IdentityService;

  const dbUser = {
    id: 'u1',
    username: 'ana',
    isActive: true,
    role: { id: 'r-member', name: 'member' },
    userGroups: [{ name: 'Taller1' }],
  };

  beforeEach(() => {
    usersService = {
      findById: jest.fn().mockResolvedValue(dbUser),
      findToken: jest.fn(),
    };
    rolesService = {
      getPermissions: jest.fn().mockResolvedValue([
        { resource: 'app', action: 'write' },
        { resource: 'pipeline', action: 'read' },
      ]),
    };
    strategy = new IdentityService(usersService as any, rolesService as any);
  });

  it('builds the identity from the database, not from the token', async () => {
    // el token dice admin de otro equipo (datos viejos del login)
    const user = await strategy.resolve({
      userId: 'u1',
      username: 'ana',
      role: 'admin',
      userGroups: ['admin'],
      permissions: ['user:write', 'config:write'],
      strategy: 'local',
    });
    expect(user).toEqual({
      userId: 'u1',
      username: 'ana',
      role: 'member',
      userGroups: ['Taller1'],
      permissions: ['app:write', 'pipeline:read'],
      strategy: 'local',
    });
  });

  it('reflects a role change immediately', async () => {
    rolesService.getPermissions.mockResolvedValue([
      { resource: 'app', action: 'read' },
    ]);
    const user = await strategy.resolve({ userId: 'u1', strategy: 'local' });
    expect(user.permissions).toEqual(['app:read']);
  });

  it('reflects a removal from a team immediately', async () => {
    usersService.findById.mockResolvedValue({ ...dbUser, userGroups: [] });
    const user = await strategy.resolve({ userId: 'u1', strategy: 'local' });
    expect(user.userGroups).toEqual([]);
  });

  it('rejects a token whose user was deleted', async () => {
    usersService.findById.mockResolvedValue(null);
    await expect(
      strategy.resolve({ userId: 'u1', strategy: 'local' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose user was disabled', async () => {
    usersService.findById.mockResolvedValue({ ...dbUser, isActive: false });
    await expect(
      strategy.resolve({ userId: 'u1', strategy: 'local' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a payload without user id', async () => {
    await expect(strategy.resolve({ strategy: 'local' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('accepts a numeric userId (tokens from v3.0.0)', async () => {
    await strategy.resolve({ userId: 7, strategy: 'local' });
    expect(usersService.findById).toHaveBeenCalledWith('7');
  });

  describe('personal tokens', () => {
    const tokenRow = {
      id: 'tok1',
      userId: 'u1',
      isActive: true,
      expiresAt: new Date(Date.now() + 3600_000),
    };
    const payload = {
      userId: 'u1',
      strategy: 'token',
      jti: 'tok1',
      permissions: ['app:write'],
    };

    it('grants only the permissions the token was created with', async () => {
      usersService.findToken.mockResolvedValue(tokenRow);
      const user = await strategy.resolve(payload);
      // pipeline:read la tiene el usuario pero no se le dio al token
      expect(user.permissions).toEqual(['app:write']);
    });

    it('never grants more than the user has today', async () => {
      usersService.findToken.mockResolvedValue(tokenRow);
      const user = await strategy.resolve({
        ...payload,
        permissions: ['app:write', 'user:write'],
      });
      expect(user.permissions).toEqual(['app:write']);
    });

    it('rejects a revoked token (its row was deleted)', async () => {
      usersService.findToken.mockResolvedValue(null);
      await expect(strategy.resolve(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a token whose row belongs to another user', async () => {
      usersService.findToken.mockResolvedValue({ ...tokenRow, userId: 'u2' });
      await expect(strategy.resolve(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an inactive or expired token row', async () => {
      usersService.findToken.mockResolvedValue({
        ...tokenRow,
        isActive: false,
      });
      await expect(strategy.resolve(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      usersService.findToken.mockResolvedValue({
        ...tokenRow,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(strategy.resolve(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('still accepts tokens issued before the jti existed', async () => {
      const { jti: _jti, ...legacy } = payload;
      const user = await strategy.resolve(legacy);
      expect(usersService.findToken).not.toHaveBeenCalled();
      expect(user.permissions).toEqual(['app:write']);
    });

    it('rejects a legacy token of a disabled user', async () => {
      usersService.findById.mockResolvedValue({ ...dbUser, isActive: false });
      const { jti: _jti, ...legacy } = payload;
      await expect(strategy.resolve(legacy)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
