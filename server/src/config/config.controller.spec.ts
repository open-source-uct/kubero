import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

describe('ConfigController', () => {
  let controller: ConfigController;
  let service: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    service = {
      getSettings: jest.fn().mockResolvedValue('settings'),
      updateSettings: jest.fn().mockResolvedValue('updated'),
      getBanner: jest.fn().mockResolvedValue('banner'),
      getTemplateConfig: jest.fn().mockResolvedValue('templates'),
      getRegistry: jest.fn().mockResolvedValue('registry'),
      getRunpacks: jest.fn().mockResolvedValue('runpacks'),
      getClusterIssuer: jest.fn().mockResolvedValue('issuer'),
      getPodSizes: jest.fn().mockResolvedValue('pods'),
      checkComponent: jest.fn().mockResolvedValue('checked'),
      validateKubeconfig: jest.fn().mockResolvedValue({ valid: true }),
      updateRunningConfig: jest.fn().mockResolvedValue('updatedConfig'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [{ provide: ConfigService, useValue: service }],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
  });

  describe('settings secrets', () => {
    const full = (): any => ({
      settings: {
        kubero: { banner: 'hola' },
        registry: {
          host: 'r.example',
          account: { username: 'u', password: 'pw', hash: 'h' },
        },
      },
      secrets: {
        GITHUB_BASEURL: 'https://api.github.com',
        GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_secret',
        GITEA_PERSONAL_ACCESS_TOKEN: '',
        BITBUCKET_USERNAME: 'bb-user',
        BITBUCKET_APP_PASSWORD: 'bb-pass',
        KUBERO_WEBHOOK_SECRET: 'whsec',
        OAUTH2_CLIENT_SECRET: 'oa',
      },
    });

    it('gives the real values to whoever has config:write', async () => {
      service.getSettings.mockResolvedValue(full());
      const res: any = await controller.getSettings({
        user: { permissions: ['config:write', 'config:read'] },
      });
      expect(res.secrets.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('ghp_secret');
      expect(res.secrets.KUBERO_WEBHOOK_SECRET).toBe('whsec');
      expect(res.settings.registry.account.password).toBe('pw');
    });

    it('masks every credential for a config:read-only user (student role)', async () => {
      service.getSettings.mockResolvedValue(full());
      const res: any = await controller.getSettings({
        user: { permissions: ['config:read'] },
      });
      const text = JSON.stringify(res);
      for (const secret of ['ghp_secret', 'bb-pass', 'whsec', 'pw"', '"h"']) {
        expect(text).not.toContain(secret);
      }
      expect(res.secrets.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('********');
      expect(res.secrets.OAUTH2_CLIENT_SECRET).toBe('********');
      expect(res.settings.registry.account.password).toBe('********');
    });

    it('keeps what is not secret and leaves empty values empty', async () => {
      service.getSettings.mockResolvedValue(full());
      const res: any = await controller.getSettings({
        user: { permissions: ['config:read'] },
      });
      expect(res.secrets.GITHUB_BASEURL).toBe('https://api.github.com');
      expect(res.secrets.BITBUCKET_USERNAME).toBe('bb-user');
      expect(res.secrets.GITEA_PERSONAL_ACCESS_TOKEN).toBe('');
      expect(res.settings.kubero.banner).toBe('hola');
      expect(res.settings.registry.host).toBe('r.example');
      expect(res.settings.registry.account.username).toBe('u');
    });

    it('masks everything when the request carries no permissions', async () => {
      service.getSettings.mockResolvedValue(full());
      const res: any = await controller.getSettings({});
      expect(JSON.stringify(res)).not.toContain('ghp_secret');
    });

    it('does not mutate what the service returned', async () => {
      const original = full();
      service.getSettings.mockResolvedValue(original);
      await controller.getSettings({ user: { permissions: ['config:read'] } });
      expect(original.secrets.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('ghp_secret');
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get settings', async () => {
    await expect(
      controller.getSettings({ user: { permissions: ['config:write'] } }),
    ).resolves.toBe('settings');
    expect(service.getSettings).toHaveBeenCalled();
  });

  it('should update settings', async () => {
    const body = { settings: { kubero: { namespace: 'kubero' } }, secrets: {} };
    await expect(controller.updateSettings(body)).resolves.toBe('updated');
    expect(service.updateSettings).toHaveBeenCalledWith(body);
  });

  it('should reject settings without the kubero section', async () => {
    await expect(controller.updateSettings({ foo: 'bar' })).rejects.toThrow(
      BadRequestException,
    );
    expect(service.updateSettings).not.toHaveBeenCalled();
  });

  it('should reject settings with an invalid namespace', async () => {
    const body = { settings: { kubero: { namespace: 'Not Valid!' } } };
    await expect(controller.updateSettings(body)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.updateSettings).not.toHaveBeenCalled();
  });

  it('should get banner', async () => {
    await expect(controller.getBanner()).resolves.toBe('banner');
    expect(service.getBanner).toHaveBeenCalled();
  });

  it('should get templates', async () => {
    await expect(controller.getTemplates()).resolves.toBe('templates');
    expect(service.getTemplateConfig).toHaveBeenCalled();
  });

  it('should get registry', async () => {
    await expect(controller.getRegistry()).resolves.toBe('registry');
    expect(service.getRegistry).toHaveBeenCalled();
  });

  it('should get runpacks', async () => {
    await expect(controller.getRunpacks()).resolves.toBe('runpacks');
    expect(service.getRunpacks).toHaveBeenCalled();
  });

  it('should get cluster issuer', async () => {
    await expect(controller.getClusterIssuer()).resolves.toBe('issuer');
    expect(service.getClusterIssuer).toHaveBeenCalled();
  });

  it('should get pod sizes', async () => {
    await expect(controller.getPodSizes()).resolves.toBe('pods');
    expect(service.getPodSizes).toHaveBeenCalled();
  });

  it('should check component', async () => {
    await expect(controller.checkComponent('test')).resolves.toBe('checked');
    expect(service.checkComponent).toHaveBeenCalledWith('test');
  });

  it('should validate kubeconfig', async () => {
    const body = { kubeconfig: 'config', context: 'ctx' };
    await expect(controller.validateKubeconfig(body)).resolves.toEqual({
      valid: true,
    });
    expect(service.validateKubeconfig).toHaveBeenCalledWith('config', 'ctx');
  });

  it('should update running config if validation is valid', async () => {
    service.validateKubeconfig.mockResolvedValueOnce({ valid: true });
    const body = {
      KUBECONFIG_BASE64: Buffer.from('config').toString('base64'),
      KUBERO_CONTEXT: 'ctx',
      KUBERO_NAMESPACE: 'ns',
      KUBERO_SESSION_KEY: 'key',
      KUBERO_WEBHOOK_SECRET: 'secret',
    };
    await expect(controller.updateRunningConfig(body)).resolves.toBe(
      'updatedConfig',
    );
    expect(service.updateRunningConfig).toHaveBeenCalled();
  });

  it('should return validation result if not valid', async () => {
    service.validateKubeconfig.mockResolvedValueOnce({ valid: false });
    const body = {
      KUBECONFIG_BASE64: Buffer.from('config').toString('base64'),
      KUBERO_CONTEXT: 'ctx',
      KUBERO_NAMESPACE: 'ns',
      KUBERO_SESSION_KEY: 'key',
      KUBERO_WEBHOOK_SECRET: 'secret',
    };
    await expect(controller.updateRunningConfig(body)).resolves.toEqual({
      valid: false,
    });
    expect(service.validateKubeconfig).toHaveBeenCalled();
  });
});
