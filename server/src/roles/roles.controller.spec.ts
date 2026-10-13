import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        { provide: RolesService, useValue: {} }, // Add this line
      ],
    }).compile();

    controller = module.get<RolesController>(RolesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

describe('RolesController scopeToOwnTeam', () => {
  let controller: RolesController;
  let rolesService: {
    createRole: jest.Mock;
    updateRole: jest.Mock;
    deleteRole: jest.Mock;
  };

  beforeEach(async () => {
    rolesService = {
      createRole: jest.fn().mockResolvedValue({ id: 'r' }),
      updateRole: jest.fn().mockResolvedValue({ id: 'r' }),
      deleteRole: jest.fn().mockResolvedValue({ id: 'r' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [{ provide: RolesService, useValue: rolesService }],
    }).compile();

    controller = module.get<RolesController>(RolesController);
  });

  const scopedReq = { user: { scopeToOwnTeam: true } };
  const unscopedReq = { user: { scopeToOwnTeam: false } };

  it('refuses to create a role for a scoped caller', async () => {
    await expect(
      controller.createRole({ name: 'x', permissions: [] }, scopedReq),
    ).rejects.toThrow(ForbiddenException);
    expect(rolesService.createRole).not.toHaveBeenCalled();
  });

  it('refuses to update a role for a scoped caller', async () => {
    await expect(
      controller.updateRole('r', { name: 'x', permissions: [] }, scopedReq),
    ).rejects.toThrow(ForbiddenException);
    expect(rolesService.updateRole).not.toHaveBeenCalled();
  });

  it('refuses to delete a role for a scoped caller', async () => {
    await expect(controller.deleteRole('r', scopedReq)).rejects.toThrow(
      ForbiddenException,
    );
    expect(rolesService.deleteRole).not.toHaveBeenCalled();
  });

  it('allows create/update/delete for an unscoped caller', async () => {
    await controller.createRole({ name: 'x', permissions: [] }, unscopedReq);
    await controller.updateRole(
      'r',
      { name: 'x', permissions: [] },
      unscopedReq,
    );
    await controller.deleteRole('r', unscopedReq);
    expect(rolesService.createRole).toHaveBeenCalled();
    expect(rolesService.updateRole).toHaveBeenCalled();
    expect(rolesService.deleteRole).toHaveBeenCalled();
  });
});
