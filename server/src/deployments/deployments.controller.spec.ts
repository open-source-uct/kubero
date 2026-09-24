import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';

const mockUserGroups = ['group1', 'group2'];

const mockJWT = {
  userId: 1,
  strategy: 'local',
  username: 'admin',
  apitoken: '1234567890',
  userGroups: mockUserGroups,
};

const mockReq = { user: mockJWT };

describe('DeploymentsController', () => {
  let controller: DeploymentsController;
  let service: jest.Mocked<DeploymentsService>;

  beforeEach(async () => {
    service = {
      listBuildjobs: jest.fn().mockResolvedValue([{ name: 'build1' }]),
      triggerBuildjob: jest.fn().mockResolvedValue({ ok: true }),
      deleteBuildjob: jest.fn().mockResolvedValue({ ok: true }),
      getBuildLogs: jest.fn().mockResolvedValue([{ log: 'line1' }]),
      assertAccess: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentsController],
      providers: [
        {
          provide: DeploymentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DeploymentsController>(DeploymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get deployments', async () => {
    const result = await controller.getDeployments(
      'pipe',
      'phase',
      'app',
      mockReq,
    );
    expect(service.listBuildjobs).toHaveBeenCalledWith(
      'pipe',
      'phase',
      'app',
      mockUserGroups,
    );
    expect(result).toEqual([{ name: 'build1' }]);
  });

  it('should build app', async () => {
    const body = {
      buildstrategy: 'dockerfile',
      repository: 'repo',
      reference: 'main',
      dockerfilePath: 'Dockerfile',
    };
    const req = { user: mockJWT };
    const result = await controller.buildApp(
      'pipe',
      'phase',
      'app',
      body as any,
      req,
    );
    expect(service.triggerBuildjob).toHaveBeenCalledWith(
      'pipe',
      'phase',
      'app',
      'dockerfile',
      'repo',
      'main',
      'Dockerfile',
      expect.objectContaining({ username: 'admin' }),
      mockUserGroups,
    );
    expect(result).toEqual({ ok: true });
  });

  it('should delete app', async () => {
    const req = { user: mockJWT };
    const result = await controller.deleteApp(
      'pipe',
      'phase',
      'app',
      'build1',
      req,
    );
    expect(service.deleteBuildjob).toHaveBeenCalledWith(
      'pipe',
      'phase',
      'app',
      'build1',
      expect.objectContaining({ username: 'admin' }),
      mockUserGroups,
    );
    expect(result).toEqual({ ok: true });
  });

  it('should get logs', async () => {
    const result = await controller.getLogs(
      'pipe',
      'phase',
      'app',
      'build1',
      'web',
      mockReq,
    );
    expect(service.getBuildLogs).toHaveBeenCalledWith(
      'pipe',
      'phase',
      'app',
      'build1',
      'web',
      mockUserGroups,
    );
    expect(result).toEqual([{ log: 'line1' }]);
  });

  it('should deploy tag', async () => {
    // Add deployApp mock to the service
    service.deployApp = jest.fn().mockResolvedValue(undefined);

    const result = await controller.deployTag(
      'pipe',
      'phase',
      'app',
      'v1.0.0',
      mockReq,
    );

    expect(service.deployApp).toHaveBeenCalledWith(
      'pipe',
      'phase',
      'app',
      'v1.0.0',
      mockUserGroups,
    );

    expect(result).toEqual({
      message:
        'Deployment triggered for app in pipe phase phase with tag v1.0.0',
      status: 'success',
    });
  });

  it('should answer 403 to a user without access and not start any deploy', async () => {
    // antes respondía 200 "Deployment triggered" y el rechazo solo quedaba en el log
    service.assertAccess.mockRejectedValue(
      new ForbiddenException('No access to this pipeline'),
    );
    service.deployApp = jest.fn();

    await expect(
      controller.deployTag('other', 'phase', 'app', 'v1.0.0', mockReq),
    ).rejects.toThrow(ForbiddenException);
    expect(service.assertAccess).toHaveBeenCalledWith(
      'other',
      'phase',
      mockUserGroups,
    );
    expect(service.deployApp).not.toHaveBeenCalled();
  });

  it('should not reject when the deploy fails after being triggered', async () => {
    service.deployApp = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(
      controller.deployTag('pipe', 'phase', 'app', 'v1.0.0', mockReq),
    ).resolves.toEqual(expect.objectContaining({ status: 'success' }));
  });
});
