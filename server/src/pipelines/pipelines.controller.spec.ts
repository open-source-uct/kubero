import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePipelineDTO } from './dto/replacePipeline.dto';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

const validDockerPipeline = {
  pipelineName: 'pipeline1',
  domain: '',
  access: { teams: ['group1'] },
  reviewapps: false,
  phases: [
    {
      name: 'production',
      enabled: true,
      context: '',
      domain: '',
      defaultEnvvars: [],
    },
  ],
  dockerimage: '',
  deploymentstrategy: 'docker',
  buildstrategy: 'plain',
};

const mockUserGroups = ['group1', 'group2'];

const mockJWT = {
  userId: 1,
  strategy: 'local',
  username: 'admin',
  apitoken: '1234567890',
  userGroups: mockUserGroups,
};

describe('PipelinesController', () => {
  let controller: PipelinesController;
  let service: jest.Mocked<PipelinesService>;

  beforeEach(async () => {
    service = {
      listPipelines: jest.fn().mockResolvedValue(['pipeline1', 'pipeline2']),
      createPipeline: jest.fn().mockResolvedValue({ ok: true }),
      getPipeline: jest.fn().mockResolvedValue({ name: 'pipeline1' }),
      updatePipeline: jest.fn().mockResolvedValue({ ok: true }),
      deletePipeline: jest.fn().mockResolvedValue({ ok: true }),
      getPipelineWithApps: jest.fn().mockResolvedValue([{ name: 'app1' }]),
      userHasAccessToPipeline: jest.fn().mockResolvedValue(true),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelinesController],
      providers: [
        {
          provide: PipelinesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PipelinesController>(PipelinesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get all pipelines', async () => {
    const req = { user: mockJWT };
    const result = await controller.getPipelines(req);
    expect(service.listPipelines).toHaveBeenCalled();
    expect(result).toEqual(['pipeline1', 'pipeline2']);
  });

  it('should create a new pipeline if pipelineName is "new"', async () => {
    const dto: any = {
      pipelineName: 'pipeline1',
      domain: 'domain',
      access: { teams: ['group1'] },
      phases: [],
      buildpack: '',
      reviewapps: false,
      dockerimage: '',
      git: {},
      registry: {},
      deploymentstrategy: '',
      buildstrategy: '',
    };

    const req = { user: mockJWT };
    const result = await controller.createPipeline('new', dto, req);
    expect(service.createPipeline).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('should complete git and registry when creating a pipeline without them', async () => {
    const dto: any = { ...validDockerPipeline };

    await controller.createPipeline('new', dto, { user: mockJWT });

    expect(service.createPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'pipeline1',
        buildpack: undefined,
        git: { keys: {}, webhook: {}, provider: '' },
        registry: { host: '', username: '', password: '' },
      }),
      expect.anything(),
    );
  });

  describe('team access', () => {
    const adminReq = {
      user: { ...mockJWT, userGroups: ['admin', 'everyone'] },
    };

    it('should reject a non admin creating a pipeline without teams', async () => {
      for (const access of [undefined, { teams: [] }]) {
        const dto: any = { ...validDockerPipeline, access };
        await expect(
          controller.createPipeline('new', dto, { user: mockJWT }),
        ).rejects.toThrow(BadRequestException);
      }
      expect(service.createPipeline).not.toHaveBeenCalled();
    });

    it('should reject a non admin updating a pipeline without teams', async () => {
      const dto: any = {
        ...validDockerPipeline,
        access: { teams: [] },
        resourceVersion: '1',
      };
      await expect(
        controller.updatePipeline(dto, { user: mockJWT }, 'pipeline1'),
      ).rejects.toThrow(BadRequestException);
      expect(service.updatePipeline).not.toHaveBeenCalled();
    });

    it('should let a non admin create a pipeline with a team', async () => {
      const dto: any = { ...validDockerPipeline };
      await controller.createPipeline('new', dto, { user: mockJWT });
      expect(service.createPipeline).toHaveBeenCalled();
    });

    describe('assigning teams', () => {
      it("should reject a non admin creating a pipeline for another team's", async () => {
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['taller2'] },
        };
        await expect(
          controller.createPipeline('new', dto, { user: mockJWT }),
        ).rejects.toThrow(ForbiddenException);
        expect(service.createPipeline).not.toHaveBeenCalled();
      });

      it('should reject a mix of own and foreign teams', async () => {
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['group1', 'taller2'] },
        };
        await expect(
          controller.createPipeline('new', dto, { user: mockJWT }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject assigning the admin team to a pipeline', async () => {
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['admin'] },
        };
        await expect(
          controller.createPipeline('new', dto, { user: mockJWT }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should let a non admin assign several of their own teams', async () => {
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['group1', 'group2'] },
        };
        await controller.createPipeline('new', dto, { user: mockJWT });
        expect(service.createPipeline).toHaveBeenCalled();
      });

      it('should let an admin assign any team', async () => {
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['taller2'] },
        };
        await controller.createPipeline('new', dto, adminReq);
        expect(service.createPipeline).toHaveBeenCalled();
      });

      it('should reject an update that assigns a foreign team', async () => {
        service.getPipeline.mockResolvedValue({
          name: 'pipeline1',
          access: { teams: ['group1'] },
        } as any);
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['group1', 'taller2'] },
          resourceVersion: '1',
        };
        await expect(
          controller.updatePipeline(dto, { user: mockJWT }, 'pipeline1'),
        ).rejects.toThrow(ForbiddenException);
        expect(service.updatePipeline).not.toHaveBeenCalled();
      });

      it('should let an update keep the foreign teams the pipeline already had', async () => {
        // el selector solo ofrece los equipos propios, pero el pipeline puede
        // haber sido compartido por un admin con otro equipo
        service.getPipeline.mockResolvedValue({
          name: 'pipeline1',
          access: { teams: ['group1', 'taller3'] },
        } as any);
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['group1', 'taller3'] },
          resourceVersion: '1',
        };
        await controller.updatePipeline(dto, { user: mockJWT }, 'pipeline1');
        expect(service.updatePipeline).toHaveBeenCalled();
      });

      it('should reject an update that removes all of the own teams', async () => {
        service.getPipeline.mockResolvedValue({
          name: 'pipeline1',
          access: { teams: ['group1', 'taller3'] },
        } as any);
        const dto: any = {
          ...validDockerPipeline,
          access: { teams: ['taller3'] },
          resourceVersion: '1',
        };
        await expect(
          controller.updatePipeline(dto, { user: mockJWT }, 'pipeline1'),
        ).rejects.toThrow(BadRequestException);
        expect(service.updatePipeline).not.toHaveBeenCalled();
      });
    });

    it('should let an admin create a pipeline without teams', async () => {
      const dto: any = { ...validDockerPipeline, access: { teams: [] } };
      await controller.createPipeline('new', dto, adminReq);
      expect(service.createPipeline).toHaveBeenCalled();
    });
  });

  describe('CreatePipelineDTO', () => {
    it('should accept a pipeline without buildpack, git and registry', async () => {
      const errors = await validate(
        plainToInstance(CreatePipelineDTO, validDockerPipeline),
      );
      expect(errors).toHaveLength(0);
    });

    it('should still reject an empty buildpack when one is sent', async () => {
      const errors = await validate(
        plainToInstance(CreatePipelineDTO, {
          ...validDockerPipeline,
          buildpack: {},
        }),
      );
      expect(errors.map((e) => e.property)).toContain('buildpack');
    });
  });

  it('should throw if pipelineName is not "new" in createPipeline', async () => {
    const dto: any = {
      pipelineName: 'pipeline1',
      domain: 'domain',
      phases: [],
      buildpack: '',
      reviewapps: false,
      dockerimage: '',
      git: {},
      registry: {},
      deploymentstrategy: '',
      buildstrategy: '',
    };
    const req = { user: mockJWT };
    await expect(
      controller.createPipeline('notnew', dto, req),
    ).rejects.toThrow();
  });

  it('should get a specific pipeline', async () => {
    const req = { user: mockJWT };
    const result = await controller.getPipeline('pipeline1', req);
    expect(service.userHasAccessToPipeline).toHaveBeenCalledWith(
      'pipeline1',
      mockUserGroups,
    );
    expect(service.getPipeline).toHaveBeenCalledWith('pipeline1');
    expect(result).toEqual({ name: 'pipeline1' });
  });

  it('should update a pipeline', async () => {
    const dto: any = {
      pipelineName: 'pipeline1',
      domain: 'domain',
      access: { teams: ['group1'] },
      phases: [],
      buildpack: '',
      reviewapps: false,
      dockerimage: '',
      git: {},
      registry: {},
      deploymentstrategy: '',
      buildstrategy: '',
      resourceVersion: '1',
    };
    const req = { user: mockJWT };
    const result = await controller.updatePipeline(dto, req, 'pipeline1');
    expect(service.updatePipeline).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('should delete a pipeline', async () => {
    const req = { user: mockJWT };
    const result = await controller.deletePipeline('pipeline1', req);
    expect(service.deletePipeline).toHaveBeenCalledWith(
      'pipeline1',
      expect.any(Object),
    );
    expect(result).toEqual({ message: '', status: 'ok' });
  });

  it('should get all apps for a pipeline', async () => {
    const req = { user: mockJWT };
    const result = await controller.getPipelineApps('pipeline1', req);
    expect(service.getPipelineWithApps).toHaveBeenCalledWith('pipeline1', [
      'group1',
      'group2',
    ]);
    expect(result).toEqual([{ name: 'app1' }]);
  });

  describe('pipeline-level access control', () => {
    // GET/PUT/DELETE por nombre solo revisaban el permiso del rol, no si el
    // usuario pertenece a algún equipo de la pipeline. Cualquiera con
    // pipeline:write (por ejemplo un student) podía tocar la pipeline de
    // otro equipo si sabía o adivinaba su nombre.
    const req = { user: mockJWT };

    beforeEach(() => {
      service.userHasAccessToPipeline = jest.fn().mockResolvedValue(false);
    });

    it('should reject getPipeline when the user has no access', async () => {
      await expect(controller.getPipeline('pipeline1', req)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.getPipeline).not.toHaveBeenCalled();
    });

    it('should reject updatePipeline when the user has no access', async () => {
      const dto: any = {
        ...validDockerPipeline,
        access: { teams: ['group1'] },
        resourceVersion: '1',
      };
      await expect(
        controller.updatePipeline(dto, req, 'pipeline1'),
      ).rejects.toThrow(ForbiddenException);
      expect(service.updatePipeline).not.toHaveBeenCalled();
    });

    it('should reject deletePipeline when the user has no access', async () => {
      await expect(controller.deletePipeline('pipeline1', req)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.deletePipeline).not.toHaveBeenCalled();
    });

    it('should reject getPipelineApps when the user has no access', async () => {
      await expect(
        controller.getPipelineApps('pipeline1', req),
      ).rejects.toThrow(ForbiddenException);
      expect(service.getPipelineWithApps).not.toHaveBeenCalled();
    });

    it('should let an admin through regardless of teams', async () => {
      const adminReq = {
        user: { ...mockJWT, userGroups: ['admin', 'everyone'] },
      };
      service.userHasAccessToPipeline = jest.fn().mockResolvedValue(true);
      await controller.getPipeline('pipeline1', adminReq);
      expect(service.getPipeline).toHaveBeenCalledWith('pipeline1');
    });
  });
});
