import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';

describe('TokenService', () => {
  let service: TokenService;

  // Mock Prisma client or any DB dependencies inside TokenService
  const mockPrisma = {
    token: {
      findMany: jest.fn().mockResolvedValue([{ id: '1', name: 'token1' }]),
      create: jest.fn().mockResolvedValue({ id: '1', name: 'token1' }),
      delete: jest.fn().mockResolvedValue({ id: '1', deleted: true }),
    },
  };

  const mockAuthService = {
    // Add any methods used by TokenService if needed
    generateToken: jest.fn().mockResolvedValue('mocked-jwt-token'),
  };

  const mockUsersService = {
    findById: jest.fn().mockResolvedValue({
      id: 'u1',
      username: 'test',
      role: { id: 'r1', name: 'admin' },
      userGroups: [{ id: 'g1', name: 'everyone' }],
    }),
  };

  const mockRolesService = {
    getPermissions: jest
      .fn()
      .mockResolvedValue([{ resource: 'app', action: 'write' }]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: RolesService, useValue: mockRolesService },
        { provide: 'PrismaClient', useValue: mockPrisma },
        TokenService,
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    // @ts-ignore
    service['prisma'] = mockPrisma;
    jest.clearAllMocks();
    mockUsersService.findById.mockResolvedValue({
      id: 'u1',
      username: 'test',
      role: { id: 'r1', name: 'admin' },
      userGroups: [{ id: 'g1', name: 'everyone' }],
    });
    mockRolesService.getPermissions.mockResolvedValue([
      { resource: 'app', action: 'write' },
    ]);
    mockAuthService.generateToken.mockResolvedValue('mocked-jwt-token');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all tokens', async () => {
      const result = await service.findAll();
      expect(mockPrisma.token.findMany).toHaveBeenCalled();
      expect(result).toEqual([{ id: '1', name: 'token1' }]);
    });
  });

  describe('create', () => {
    it('should create a token', async () => {
      const result = await service.create('token1', '2025-01-01', 'u1');
      expect(mockUsersService.findById).toHaveBeenCalledWith('u1');
      expect(mockPrisma.token.create).toHaveBeenCalled();
      expect(result).toEqual({"expiresAt": "2025-01-01", "name": "token1", "token": "mocked-jwt-token" });
    });

    it('should read the role, groups and permissions from the database, not from arguments', async () => {
      await service.create('token1', '2025-01-01', 'u1');
      expect(mockRolesService.getPermissions).toHaveBeenCalledWith('r1');
      expect(mockAuthService.generateToken).toHaveBeenCalledWith(
        'u1',
        'test',
        'admin',
        ['everyone'],
        ['app:write'],
        '2025-01-01',
      );
      const createCall = mockPrisma.token.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('admin');
      expect(createCall.data.groups).toBe('everyone');
    });

    it('should throw if the user does not exist', async () => {
      mockUsersService.findById.mockResolvedValueOnce(null);
      await expect(
        service.create('token1', '2025-01-01', 'u1'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('delete', () => {
    it('should delete a token by id', async () => {
      const result = await service.delete('1');
      expect(mockPrisma.token.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual({ id: '1', deleted: true });
    });
  });
});



