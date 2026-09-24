import { ForbiddenException } from '@nestjs/common';
import { PipelinesService } from '../pipelines/pipelines.service';
import { Test, TestingModule } from '@nestjs/testing';
import { KubernetesController } from './kubernetes.controller';
import { KubernetesService } from './kubernetes.service';
import { IStorageClass } from './kubernetes.interface';
import { CoreV1Event } from '@kubernetes/client-node';

export const mockStorageClass = {
  name: 'fast',
  provisioner: 'kubernetes.io/aws-ebs',
  reclaimPolicy: 'Delete',
  volumeBindingMode: 'Immediate',
  allowVolumeExpansion: true,
  parameters: {
    type: 'gp2',
    encrypted: 'true',
  },
} as IStorageClass;

export const mockCoreV1Event: CoreV1Event = {
  metadata: {
    name: 'event1',
    namespace: 'default',
    creationTimestamp: new Date('2024-01-01T00:00:00Z'),
  },
  message: 'Pod started',
  reason: 'Started',
  type: 'Normal',
  involvedObject: {
    kind: 'Pod',
    name: 'my-app-123',
    namespace: 'default',
  },
  source: {
    component: 'kubelet',
    host: 'node1',
  },
  firstTimestamp: new Date('2024-01-01T00:00:00Z'),
  lastTimestamp: new Date('2024-01-01T00:05:00Z'),
  count: 1,
};

/*
export const mockContext: Context = {
  cluster: 'test-cluster',
  user: 'test-user',
  name: 'context1',
  namespace: 'default',
};
*/

describe('KubernetesController', () => {
  let controller: KubernetesController;
  let service: jest.Mocked<KubernetesService>;
  let pipelines: { listPipelines: jest.Mock };
  const adminReq = { user: { userGroups: ['admin'] } };

  beforeEach(async () => {
    service = {
      getEvents: jest.fn(),
      getStorageClasses: jest.fn(),
      getDomains: jest.fn(),
      getContexts: jest.fn(),
      setCurrentContext: jest.fn(),
    } as any;
    pipelines = {
      listPipelines: jest.fn().mockResolvedValue({
        items: [{ name: 'mine', phases: [{ name: 'dev', context: 'ctx1' }] }],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KubernetesController],
      providers: [
        { provide: KubernetesService, useValue: service },
        { provide: PipelinesService, useValue: pipelines },
      ],
    }).compile();

    controller = module.get<KubernetesController>(KubernetesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getEvents access', () => {
    const teamReq = { user: { userGroups: ['Taller1'] } };

    it('should let a team read the events of its own pipeline namespace', async () => {
      service.getEvents.mockResolvedValue([]);
      await controller.getEvents('mine-dev', teamReq);
      expect(service.setCurrentContext).toHaveBeenCalledWith('ctx1');
      expect(service.getEvents).toHaveBeenCalledWith('mine-dev');
    });

    it('should refuse the events of a namespace outside its pipelines', async () => {
      await expect(
        controller.getEvents('kube-system', teamReq),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getEvents('ramtun-production', teamReq),
      ).rejects.toThrow(ForbiddenException);
      expect(service.getEvents).not.toHaveBeenCalled();
    });

    it('should let the admin team read any namespace', async () => {
      service.getEvents.mockResolvedValue([]);
      await controller.getEvents('kube-system', adminReq);
      expect(pipelines.listPipelines).not.toHaveBeenCalled();
      expect(service.getEvents).toHaveBeenCalledWith('kube-system');
    });
  });

  it('should get events', async () => {
    service.getEvents.mockResolvedValue([mockCoreV1Event]);
    const result = await controller.getEvents('default', adminReq);
    expect(service.getEvents).toHaveBeenCalledWith('default');
    expect(result).toEqual([
      {
        count: 1,
        firstTimestamp: new Date('2024-01-01T00:00:00Z'),
        involvedObject: {
          kind: 'Pod',
          name: 'my-app-123',
          namespace: 'default',
        },
        lastTimestamp: new Date('2024-01-01T00:05:00Z'),
        message: 'Pod started',
        metadata: {
          creationTimestamp: new Date('2024-01-01T00:00:00Z'),
          name: 'event1',
          namespace: 'default',
        },
        reason: 'Started',
        source: {
          component: 'kubelet',
          host: 'node1',
        },
        type: 'Normal',
      },
    ]);
  });

  it('should get storage classes', async () => {
    service.getStorageClasses.mockResolvedValue([mockStorageClass]);
    const result = await controller.getStorageClasses();
    expect(service.getStorageClasses).toHaveBeenCalled();
    expect(result).toEqual([
      {
        allowVolumeExpansion: true,
        name: 'fast',
        parameters: {
          encrypted: 'true',
          type: 'gp2',
        },
        provisioner: 'kubernetes.io/aws-ebs',
        reclaimPolicy: 'Delete',
        volumeBindingMode: 'Immediate',
      },
    ]);
  });

  it('should get domains', async () => {
    service.getDomains.mockResolvedValue(['domain1.com', 'domain2.com']);
    const result = await controller.getDomains();
    expect(service.getDomains).toHaveBeenCalled();
    expect(result).toEqual(['domain1.com', 'domain2.com']);
  });
  /*
  it('should get contexts', async () => {
    service.getContexts.mockResolvedValue([{ name: 'context1' }]);
    const result = await controller.getContexts();
    expect(service.getContexts).toHaveBeenCalled();
    expect(result).toEqual([{ name: 'context1' }]);
  });
*/
});
