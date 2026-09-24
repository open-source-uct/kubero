import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PipelinesService } from '../pipelines/pipelines.service';

describe('AuditController', () => {
  let controller: AuditController;
  let audit: { get: jest.Mock; getAppEntries: jest.Mock };
  let pipelines: { getContext: jest.Mock; listPipelines: jest.Mock };

  const reqOf = (userGroups: string[]) => ({ user: { userGroups } });

  beforeEach(async () => {
    audit = {
      get: jest.fn().mockResolvedValue({ audit: [], count: 0, limit: 100 }),
      getAppEntries: jest
        .fn()
        .mockResolvedValue({ audit: [], count: 0, limit: 100 }),
    };
    pipelines = {
      getContext: jest.fn().mockResolvedValue('ctx'),
      listPipelines: jest.fn().mockResolvedValue({
        items: [{ name: 'taller1-a' }, { name: 'taller1-b' }],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: audit },
        { provide: PipelinesService, useValue: pipelines },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAuditAll', () => {
    it('should give the admin team the whole audit log', async () => {
      await controller.getAuditAll(100, reqOf(['admin']));
      expect(audit.get).toHaveBeenCalledWith(100);
      expect(pipelines.listPipelines).not.toHaveBeenCalled();
    });

    it('should restrict any other team to the pipelines it can access', async () => {
      await controller.getAuditAll(100, reqOf(['Taller1']));
      expect(pipelines.listPipelines).toHaveBeenCalledWith(['Taller1']);
      expect(audit.get).toHaveBeenCalledWith(100, ['taller1-a', 'taller1-b']);
    });

    it('should not fall back to the whole log when the user has no teams', async () => {
      pipelines.listPipelines.mockResolvedValue({ items: [] });
      await controller.getAuditAll(100, { user: {} });
      expect(audit.get).toHaveBeenCalledWith(100, []);
    });
  });

  describe('getAudit (per app)', () => {
    it('should return the entries when the user can access the pipeline', async () => {
      await controller.getAudit('p', 'dev', 'app', 50, reqOf(['Taller1']));
      expect(pipelines.getContext).toHaveBeenCalledWith('p', 'dev', [
        'Taller1',
      ]);
      expect(audit.getAppEntries).toHaveBeenCalledWith('p', 'dev', 'app', 50);
    });

    it('should not return the entries of a pipeline the user cannot access', async () => {
      pipelines.getContext.mockRejectedValue(new ForbiddenException());
      await expect(
        controller.getAudit('other', 'dev', 'app', 50, reqOf(['Taller1'])),
      ).rejects.toThrow(ForbiddenException);
      expect(audit.getAppEntries).not.toHaveBeenCalled();
    });
  });
});
