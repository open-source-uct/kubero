import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppsService, addonsByName } from './apps.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import { KubernetesService } from '../kubernetes/kubernetes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '../config/config.service';
import { EventsGateway } from '../events/events.gateway';
import { App } from './app/app';
import { IApp } from './apps.interface';
import { IPodSize, ISecurityContext } from 'src/config/config.interface';
import { IUser } from 'src/auth/auth.interface';
import { IKubectlApp } from 'src/kubernetes/kubernetes.interface';

const podsize: IPodSize = {
  name: 'small',
  resources: {},
  description: '',
};

const mockSecurityContext: ISecurityContext = {
  runAsUser: 1000,
  runAsGroup: 1000,
  allowPrivilegeEscalation: false,
  readOnlyRootFilesystem: false,
  runAsNonRoot: true,
  capabilities: { add: [], drop: [] },
};

const mockApp = {
  name: 'app',
  pipeline: 'pipeline',
  phase: 'phase',
  sleep: 'false',
  buildpack: 'nodejs',
  deploymentstrategy: 'git' as const,
  buildstrategy: 'plain' as const,
  branch: 'main',
  autodeploy: true,
  podsize,
  autoscale: false,
  basicAuth: {
    enabled: true,
    realm: 'TestRealm',
    accounts: [
      { user: 'user1', pass: 'pass1' },
      { user: 'user2', pass: 'pass2' },
    ],
  },
  envVars: [],
  extraVolumes: [],
  cronjobs: [],
  addons: [],
  web: {
    replicaCount: 1,
    autoscaling: { minReplicas: 1, maxReplicas: 2 },
  },
  worker: {
    replicaCount: 1,
    autoscaling: { minReplicas: 1, maxReplicas: 2 },
  },
  image: {
    containerPort: 8080,
    repository: 'repo',
    tag: 'tag',
    command: ['npm'],
    fetch: {
      repository: 'repo',
      tag: 'tag',
      securityContext: mockSecurityContext,
    },
    build: {
      repository: 'repo',
      tag: 'tag',
      securityContext: mockSecurityContext,
    },
    run: {
      repository: 'repo',
      tag: 'tag',
      securityContext: mockSecurityContext,
    },
    pullPolicy: 'Always',
  },
  serviceAccount: { annotations: {}, create: true, name: 'svc' },
  ingress: {
    annotations: {},
    className: '',
    enabled: false,
    hosts: [{ host: 'localhost', paths: [{ path: '/', pathType: 'Prefix' }] }],
    tls: [],
  },
  healthcheck: {
    enabled: true,
    path: '/health',
    startupSeconds: 1,
    timeoutSeconds: 1,
    periodSeconds: 1,
  },
  resources: {
    limits: { cpu: '100m', memory: '128Mi' },
    requests: { cpu: '100m', memory: '128Mi' },
  },
} as IApp;

const mockUSerGroups = ['group1', 'group2'];

export const mockKubectlApp = {
  apiVersion: 'kubero.io/v1',
  kind: 'KuberoApp',
  spec: mockApp,
  status: {},
} as IKubectlApp;

describe('AppsService', () => {
  let service: AppsService;
  let kubectl: jest.Mocked<KubernetesService>;
  let pipelinesService: jest.Mocked<PipelinesService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  const user: IUser = { id: '1', username: 'testuser' } as IUser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppsService,
        {
          provide: KubernetesService,
          useValue: {
            getApp: jest.fn(),
            createApp: jest.fn(),
            deleteApp: jest.fn(),
            setCurrentContext: jest.fn(),
            createBuildJob: jest.fn(),
            getAllAppsList: jest.fn(),
            restartApp: jest.fn(),
            getPods: jest.fn(),
            updateApp: jest.fn(),
            execInContainer: jest.fn(),
            ensureSharedTlsSecret: jest.fn(),
            getAddonVolumes: jest.fn().mockResolvedValue([]),
            deleteAddonVolumes: jest.fn().mockResolvedValue([]),
            replaceAppObject: jest.fn(),
          },
        },
        {
          provide: PipelinesService,
          useValue: { getContext: jest.fn(), listPipelines: jest.fn() },
        },
        { provide: NotificationsService, useValue: { send: jest.fn() } },
        { provide: ConfigService, useValue: { getPodSizes: jest.fn() } },
        {
          provide: EventsGateway,
          useValue: { execStreams: {}, sendTerminalLine: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AppsService>(AppsService);
    kubectl = module.get(KubernetesService);
    pipelinesService = module.get(PipelinesService);
    notificationsService = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getApp', () => {
    it('should return app if context exists', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.getApp as jest.Mock).mockResolvedValue({
        metadata: {},
        status: {},
      });
      const result = await service.getApp('p', 'ph', 'a', mockUSerGroups);
      expect(result).toBeDefined();
      expect(kubectl.getApp).toHaveBeenCalled();
    });
    it('returns an app the operator has not processed yet (no status) instead of failing', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.getApp as jest.Mock).mockResolvedValue({
        metadata: { name: 'a' },
        spec: { name: 'a' },
      });
      const result = await service.getApp('p', 'ph', 'a', mockUSerGroups);
      expect(result).toEqual({
        metadata: { name: 'a', managedFields: [{}] },
        spec: { name: 'a' },
      });
    });

    it('hides the deployed release manifest when the app has a status', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.getApp as jest.Mock).mockResolvedValue({
        metadata: {},
        status: { deployedRelease: { name: 'a', manifest: 'secret stuff' } },
      });
      const result: any = await service.getApp('p', 'ph', 'a', mockUSerGroups);
      expect(result.status.deployedRelease).toBeUndefined();
    });

    it('throws NotFound (not an empty 200) when the app does not exist', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.getApp as jest.Mock).mockResolvedValue({});
      await expect(
        service.getApp('p', 'ph', 'a', mockUSerGroups),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates Kubernetes errors instead of returning null', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.getApp as jest.Mock).mockRejectedValue(new Error('forbidden'));
      await expect(
        service.getApp('p', 'ph', 'a', mockUSerGroups),
      ).rejects.toThrow('forbidden');
    });

    it('should return null if context does not exist', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue(null);
      const result = await service.getApp('p', 'ph', 'a', mockUSerGroups);
      expect(result).toBeUndefined();
    });
  });

  describe('createApp', () => {
    beforeEach(() => {
      process.env.KUBERO_READONLY = 'false';
    });
    it('should call createApp and send notification', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      const app = new App(mockApp);
      await service.createApp(app, { username: 'u' } as any, mockUSerGroups);
      expect(kubectl.createApp).toHaveBeenCalled();
      expect(notificationsService.send).toHaveBeenCalled();
    });
    it('should not call createApp if readonly', async () => {
      process.env.KUBERO_READONLY = 'true';
      const app = new App(mockApp);
      await service.createApp(app, { username: 'u' } as any, mockUSerGroups);
      expect(kubectl.createApp).not.toHaveBeenCalled();
    });
    it('should replace the ingress secretName and drop cert-manager annotations when a shared TLS secret is returned', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.ensureSharedTlsSecret as jest.Mock).mockResolvedValue(
        'inf-uct-cl-tls',
      );
      const app = new App(mockApp);
      app.ingress.tls = [{ hosts: ['app.inf.uct.cl'], secretName: 'app-tls' }];
      app.ingress.annotations = {
        'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
        'kubernetes.io/tls-acme': 'true',
      };

      await service.createApp(app, { username: 'u' } as any, mockUSerGroups);

      expect(kubectl.ensureSharedTlsSecret).toHaveBeenCalledWith(
        `${app.pipeline}-${app.phase}`,
        'ctx',
      );
      expect(app.ingress.tls[0].secretName).toBe('inf-uct-cl-tls');
      const annotationKeys = Object.keys(app.ingress.annotations);
      expect(annotationKeys).not.toContain('cert-manager.io/cluster-issuer');
      expect(annotationKeys).not.toContain('kubernetes.io/tls-acme');
    });
    it('should leave the ingress untouched when no shared TLS secret is configured', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.ensureSharedTlsSecret as jest.Mock).mockResolvedValue(null);
      const app = new App(mockApp);
      app.ingress.tls = [{ hosts: ['app.inf.uct.cl'], secretName: 'app-tls' }];
      app.ingress.annotations = {
        'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
      };

      await service.createApp(app, { username: 'u' } as any, mockUSerGroups);

      expect(app.ingress.tls[0].secretName).toBe('app-tls');
      expect(Object.keys(app.ingress.annotations)).toContain(
        'cert-manager.io/cluster-issuer',
      );
    });
  });

  describe('deleteApp', () => {
    beforeEach(() => {
      process.env.KUBERO_READONLY = 'false';
    });
    it('should call deleteApp and send notification', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      await service.deleteApp(
        'p',
        'ph',
        'a',
        { username: 'u' } as any,
        mockUSerGroups,
      );
      expect(kubectl.deleteApp).toHaveBeenCalled();
      expect(notificationsService.send).toHaveBeenCalled();
    });
    it('should not call deleteApp if readonly', async () => {
      process.env.KUBERO_READONLY = 'true';
      await service.deleteApp(
        'p',
        'ph',
        'a',
        { username: 'u' } as any,
        mockUSerGroups,
      );
      expect(kubectl.deleteApp).not.toHaveBeenCalled();
    });
  });

  describe('triggerImageBuild', () => {
    it('should call createBuildJob', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      jest.spyOn(service, 'getApp').mockResolvedValue({
        spec: {
          gitrepo: { admin: true, ssh_url: 'repo' },
          buildstrategy: 'dockerfile',
          branch: 'main',
        },
      } as any);
      await service.triggerImageBuild('p', 'ph', 'a', mockUSerGroups);
      expect(kubectl.createBuildJob).toHaveBeenCalled();
    });
  });

  describe('getAllAppsList', () => {
    it('should return list of apps', async () => {
      (kubectl.getAllAppsList as jest.Mock).mockResolvedValue({
        items: [{ spec: { name: 'a' } }],
      });
      const result = await service.getAllAppsList('ctx');
      expect(result).toEqual([{ name: 'a' }]);
    });
  });

  describe('getAppsByRepoAndBranch', () => {
    it('should filter apps by repo and branch', async () => {
      jest.spyOn(service, 'getAllAppsList').mockResolvedValue([
        { branch: 'main', gitrepo: { ssh_url: 'repo' } },
        { branch: 'dev', gitrepo: { ssh_url: 'repo' } },
      ] as any);
      const result = await service.getAppsByRepoAndBranch('repo', 'main');
      expect(result.length).toBe(1);
      expect(result[0].branch).toBe('main');
    });
  });

  describe('rebuildApp', () => {
    it('should call restartApp for docker/plain', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      const app = {
        name: 'a',
        pipeline: 'p',
        phase: 'ph',
        deploymentstrategy: 'docker',
        buildstrategy: 'plain',
      } as any;
      await service.rebuildApp(app, mockUSerGroups);
      expect(kubectl.restartApp).toHaveBeenCalled();
      expect(notificationsService.send).toHaveBeenCalled();
    });
    it('should call triggerImageBuild for git/dockerfile', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      const app = {
        name: 'a',
        pipeline: 'p',
        phase: 'ph',
        deploymentstrategy: 'git',
        buildstrategy: 'dockerfile',
      } as any;
      const spy = jest
        .spyOn(service, 'triggerImageBuild')
        .mockResolvedValue({} as any);
      await service.rebuildApp(app, mockUSerGroups);
      expect(spy).toHaveBeenCalled();
      expect(notificationsService.send).toHaveBeenCalled();
    });
  });

  describe('addons: inmutables una vez creados, y sus volúmenes', () => {
    const pg = (name: string, password: string, reorder = false) => {
      const auth = reorder
        ? { password, username: 'u', postgresPassword: 'p', database: 'd' }
        : { postgresPassword: 'p', username: 'u', password, database: 'd' };
      return {
        kind: 'KuberoAddonPostgres',
        resourceDefinitions: {
          KuberoAddonPostgres: {
            metadata: { name },
            spec: { postgres: { auth } },
          },
        },
      };
    };
    const appWith = (addons: unknown[]) =>
      new App({ ...mockApp, addons } as any);
    const stored = (addons: unknown[]) => ({ metadata: {}, spec: { addons } });

    beforeEach(() => {
      process.env.KUBERO_READONLY = 'false';
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
    });

    it('rejects changing the data of an existing addon, before touching the cluster', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres', 'old')]),
      );
      await expect(
        service.updateApp(
          appWith([pg('app-postgres', 'new')]),
          'rv',
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(kubectl.updateApp).not.toHaveBeenCalled();
      expect(kubectl.deleteAddonVolumes).not.toHaveBeenCalled();
    });

    it('accepts an unchanged addon even if the client sends its keys in another order', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres', 'same')]),
      );
      await service.updateApp(
        appWith([pg('app-postgres', 'same', true)]),
        'rv',
        user,
        mockUSerGroups,
      );
      expect(kubectl.updateApp).toHaveBeenCalled();
      expect(kubectl.deleteAddonVolumes).not.toHaveBeenCalled();
    });

    it('deletes the data volumes of a removed addon after saving the app', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres', 'x')]),
      );
      await service.updateApp(appWith([]), 'rv', user, mockUSerGroups);
      expect(kubectl.updateApp).toHaveBeenCalled();
      expect(kubectl.deleteAddonVolumes).toHaveBeenCalledWith(
        'pipeline-phase',
        'app-postgres',
        'ctx',
      );
    });

    it('still saves the app if deleting the volume fails', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres', 'x')]),
      );
      (kubectl.deleteAddonVolumes as jest.Mock).mockRejectedValue(
        new Error('forbidden'),
      );
      await expect(
        service.updateApp(appWith([]), 'rv', user, mockUSerGroups),
      ).resolves.not.toThrow();
      expect(kubectl.updateApp).toHaveBeenCalled();
    });

    it('rejects a new addon whose name still has a volume from a previous one', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(stored([]));
      (kubectl.getAddonVolumes as jest.Mock).mockResolvedValue([
        { metadata: { name: 'data-app-postgres-0' } },
      ]);
      await expect(
        service.updateApp(
          appWith([pg('app-postgres', 'x')]),
          'rv',
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(ConflictException);
      expect(kubectl.updateApp).not.toHaveBeenCalled();
    });

    it('tells the user to wait when that volume is still being deleted', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(stored([]));
      (kubectl.getAddonVolumes as jest.Mock).mockResolvedValue([
        {
          metadata: {
            name: 'data-app-postgres-0',
            deletionTimestamp: new Date(),
          },
        },
      ]);
      await expect(
        service.updateApp(
          appWith([pg('app-postgres', 'x')]),
          'rv',
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow('todavía se está borrando');
    });

    it('checks for leftover volumes when creating an app too', async () => {
      (kubectl.getAddonVolumes as jest.Mock).mockResolvedValue([
        { metadata: { name: 'data-app-postgres-0' } },
      ]);
      await expect(
        service.createApp(
          appWith([pg('app-postgres', 'x')]),
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(ConflictException);
      expect(kubectl.createApp).not.toHaveBeenCalled();
    });

    it('deletes the data volumes of every addon when the app is deleted', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres', 'x'), pg('app-redis', 'y')]),
      );
      await service.deleteApp('pipeline', 'phase', 'app', user, mockUSerGroups);
      expect(kubectl.deleteApp).toHaveBeenCalled();
      expect(kubectl.deleteAddonVolumes).toHaveBeenCalledWith(
        'pipeline-phase',
        'app-postgres',
        'ctx',
      );
      expect(kubectl.deleteAddonVolumes).toHaveBeenCalledWith(
        'pipeline-phase',
        'app-redis',
        'ctx',
      );
    });

    it('never builds a label selector from an invalid addon name', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('bad name', 'x')]),
      );
      await service.deleteApp('pipeline', 'phase', 'app', user, mockUSerGroups);
      expect(kubectl.deleteAddonVolumes).not.toHaveBeenCalled();
    });
  });

  describe('addons al instante (agregar y quitar sin "Actualizar")', () => {
    const pg = (name: string, extra: object = {}) => ({
      kind: 'KuberoAddonPostgres',
      resourceDefinitions: {
        KuberoAddonPostgres: {
          metadata: { name },
          spec: { postgres: { auth: { postgresPassword: 'p', ...extra } } },
        },
      },
    });
    const stored = (addons: unknown[], resourceVersion = '10') => ({
      apiVersion: 'application.kubero.dev/v1alpha1',
      kind: 'KuberoApp',
      metadata: { name: 'app', resourceVersion },
      spec: { name: 'app', image: { repository: 'ghcr.io/x/app' }, addons },
    });
    const replaced = () =>
      (kubectl.replaceAppObject as jest.Mock).mock.calls.map((c) => c[2]);
    const conflict = new ConflictException('changed');

    beforeEach(() => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.replaceAppObject as jest.Mock).mockResolvedValue({
        metadata: { resourceVersion: '11', generation: 4 },
      });
      AppsService.VOLUME_WAIT_MS = 50;
      AppsService.VOLUME_POLL_MS = 1;
    });

    it('adds the addon to the stored app, keeps the rest and returns the new version', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-redis')]),
      );
      const result = await service.addAddon(
        'pipe',
        'prod',
        'app',
        pg('app-postgres'),
        user,
        mockUSerGroups,
      );
      expect(result).toEqual({ resourceVersion: '11', generation: 4 });
      const body = replaced()[0];
      expect(body.metadata.resourceVersion).toBe('10');
      expect(body.spec.image).toEqual({ repository: 'ghcr.io/x/app' });
      expect(body.spec.addons).toHaveLength(2);
      expect(notificationsService.send).toHaveBeenCalled();
    });

    it('rejects an invalid addon before touching the cluster', async () => {
      const noPassword = pg('app-postgres');
      (
        noPassword.resourceDefinitions.KuberoAddonPostgres.spec.postgres
          .auth as any
      ).postgresPassword = '';
      await expect(
        service.addAddon(
          'pipe',
          'prod',
          'app',
          noPassword,
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(kubectl.getApp).not.toHaveBeenCalled();
      expect(kubectl.replaceAppObject).not.toHaveBeenCalled();
    });

    it('rejects an addon whose name the app already uses', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres')]),
      );
      await expect(
        service.addAddon(
          'pipe',
          'prod',
          'app',
          pg('app-postgres'),
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(ConflictException);
      expect(kubectl.replaceAppObject).not.toHaveBeenCalled();
    });

    it('rejects an addon whose name still has the volume of a previous one', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(stored([]));
      (kubectl.getAddonVolumes as jest.Mock).mockResolvedValue([
        { metadata: { name: 'data-app-postgres-0' } },
      ]);
      await expect(
        service.addAddon(
          'pipe',
          'prod',
          'app',
          pg('app-postgres'),
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(ConflictException);
      expect(kubectl.replaceAppObject).not.toHaveBeenCalled();
    });

    it('reads the app again and retries when someone saved it in between', async () => {
      (kubectl.getApp as jest.Mock)
        .mockResolvedValueOnce(stored([], '10'))
        .mockResolvedValueOnce(stored([pg('app-redis')], '12'));
      (kubectl.replaceAppObject as jest.Mock)
        .mockRejectedValueOnce(conflict)
        .mockResolvedValueOnce({ metadata: { resourceVersion: '13' } });
      const result = await service.addAddon(
        'pipe',
        'prod',
        'app',
        pg('app-postgres'),
        user,
        mockUSerGroups,
      );
      expect(result.resourceVersion).toBe('13');
      // el segundo intento parte de la versión nueva y no pierde el otro addon
      expect(replaced()[1].metadata.resourceVersion).toBe('12');
      expect(replaced()[1].spec.addons).toHaveLength(2);
    });

    it('gives up after a few conflicts instead of overwriting', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(stored([]));
      (kubectl.replaceAppObject as jest.Mock).mockRejectedValue(conflict);
      await expect(
        service.addAddon(
          'pipe',
          'prod',
          'app',
          pg('app-postgres'),
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(ConflictException);
      expect(kubectl.replaceAppObject).toHaveBeenCalledTimes(
        AppsService.ADDON_CHANGE_ATTEMPTS,
      );
    });

    it('answers 404 when the app does not exist', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue({});
      await expect(
        service.addAddon(
          'pipe',
          'prod',
          'app',
          pg('app-postgres'),
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('removes only that addon, deletes its volume and waits until it is gone', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres'), pg('app-redis')]),
      );
      (kubectl.getAddonVolumes as jest.Mock)
        .mockResolvedValueOnce([{ metadata: { name: 'data-app-postgres-0' } }])
        .mockResolvedValue([]);
      const result = await service.removeAddon(
        'pipe',
        'prod',
        'app',
        'app-postgres',
        user,
        mockUSerGroups,
      );
      expect(result).toEqual({
        resourceVersion: '11',
        generation: 4,
        volumesPending: false,
      });
      const kept = replaced()[0].spec.addons;
      expect(kept).toHaveLength(1);
      expect(
        kept[0].resourceDefinitions.KuberoAddonPostgres.metadata.name,
      ).toBe('app-redis');
      expect(kubectl.deleteAddonVolumes).toHaveBeenCalledWith(
        'pipe-prod',
        'app-postgres',
        'ctx',
      );
    });

    it('tells the client when the volume is still being deleted', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-postgres')]),
      );
      (kubectl.getAddonVolumes as jest.Mock).mockResolvedValue([
        { metadata: { name: 'data-app-postgres-0', deletionTimestamp: 'x' } },
      ]);
      const result = await service.removeAddon(
        'pipe',
        'prod',
        'app',
        'app-postgres',
        user,
        mockUSerGroups,
      );
      expect(result.volumesPending).toBe(true);
    });

    it('answers 404 for an addon the app does not have, without changing it', async () => {
      (kubectl.getApp as jest.Mock).mockResolvedValue(
        stored([pg('app-redis')]),
      );
      await expect(
        service.removeAddon(
          'pipe',
          'prod',
          'app',
          'app-postgres',
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(kubectl.replaceAppObject).not.toHaveBeenCalled();
      expect(kubectl.deleteAddonVolumes).not.toHaveBeenCalled();
    });

    it('rejects an invalid addon name before reading the app', async () => {
      await expect(
        service.removeAddon(
          'pipe',
          'prod',
          'app',
          'Mi Base',
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(kubectl.getApp).not.toHaveBeenCalled();
    });

    it('does not touch apps of pipelines the user cannot access', async () => {
      (pipelinesService.getContext as jest.Mock).mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(
        service.removeAddon(
          'pipe',
          'prod',
          'app',
          'app-postgres',
          user,
          mockUSerGroups,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(kubectl.getApp).not.toHaveBeenCalled();
    });
  });

  describe('addonsByName', () => {
    it('maps metadata.name to its definition and ignores malformed entries', () => {
      const map = addonsByName([
        { resourceDefinitions: { K: { metadata: { name: 'a' } } } },
        { resourceDefinitions: null },
        {},
        'junk',
      ]);
      expect([...map.keys()]).toEqual(['a']);
      expect(addonsByName(undefined).size).toBe(0);
    });
  });

  describe('updateApp', () => {
    beforeEach(() => {
      process.env.KUBERO_READONLY = 'false';
    });
    it('should call updateApp and send notification', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      const app = new App(mockApp);
      await service.updateApp(
        app,
        'rv',
        { username: 'u' } as any,
        mockUSerGroups,
      );
      expect(kubectl.updateApp).toHaveBeenCalled();
      expect(notificationsService.send).toHaveBeenCalled();
    });
    describe('versión de la app al guardar', () => {
      const stored = (resourceVersion: string, generation: number) => ({
        metadata: { name: 'app', resourceVersion, generation },
        spec: { addons: [] },
      });
      const savedVersion = () =>
        (kubectl.updateApp as jest.Mock).mock.calls[0][1];

      beforeEach(() => {
        (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      });

      it('saves over the current version when only the status written by the operator changed', async () => {
        // el formulario cargó la versión 100 (generation 7); después el
        // operador escribió el estado y la app quedó en la 105, sin cambiar
        // su configuración
        (kubectl.getApp as jest.Mock).mockResolvedValue(stored('105', 7));
        await service.updateApp(
          new App(mockApp),
          '100',
          user,
          mockUSerGroups,
          '7',
        );
        expect(savedVersion()).toBe('105');
      });

      it('keeps the loaded version when someone changed the configuration, so the conflict is reported', async () => {
        (kubectl.getApp as jest.Mock).mockResolvedValue(stored('105', 8));
        await service.updateApp(
          new App(mockApp),
          '100',
          user,
          mockUSerGroups,
          '7',
        );
        expect(savedVersion()).toBe('100');
      });

      it('keeps the loaded version when the client does not send the generation', async () => {
        (kubectl.getApp as jest.Mock).mockResolvedValue(stored('105', 7));
        await service.updateApp(new App(mockApp), '100', user, mockUSerGroups);
        expect(savedVersion()).toBe('100');
      });
    });

    it('should not call updateApp if readonly', async () => {
      process.env.KUBERO_READONLY = 'true';
      const app = new App(mockApp);
      await service.updateApp(
        app,
        'rv',
        { username: 'u' } as any,
        mockUSerGroups,
      );
      expect(kubectl.updateApp).not.toHaveBeenCalled();
    });
    it('should replace the ingress secretName and drop cert-manager annotations when a shared TLS secret is returned', async () => {
      (pipelinesService.getContext as jest.Mock).mockResolvedValue('ctx');
      (kubectl.ensureSharedTlsSecret as jest.Mock).mockResolvedValue(
        'inf-uct-cl-tls',
      );
      const app = new App(mockApp);
      app.ingress.tls = [{ hosts: ['app.inf.uct.cl'], secretName: 'app-tls' }];
      app.ingress.annotations = {
        'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
        'kubernetes.io/tls-acme': 'true',
      };

      await service.updateApp(
        app,
        'rv',
        { username: 'u' } as any,
        mockUSerGroups,
      );

      expect(app.ingress.tls[0].secretName).toBe('inf-uct-cl-tls');
      expect(Object.keys(app.ingress.annotations)).not.toContain(
        'cert-manager.io/cluster-issuer',
      );
    });
  });

  describe('execInContainer', () => {
    let service: AppsService;
    let mockPipelinesService: any;
    let mockKubernetesService: any;
    let mockEventsGateway: any;

    beforeEach(() => {
      mockPipelinesService = {
        getContext: jest.fn().mockResolvedValue('test-context'),
      };
      mockKubernetesService = {
        execInContainer: jest.fn(),
      };
      mockEventsGateway = {
        execStreams: {},
        sendTerminalLine: jest.fn(),
      };

      service = new AppsService(
        mockKubernetesService,
        mockPipelinesService,
        {} as any, // NotificationsService
        {} as any, // ConfigService
        mockEventsGateway,
      );
    });

    it('should not execute if no context is found', async () => {
      mockPipelinesService.getContext.mockResolvedValueOnce(undefined);
      await expect(
        service.execInContainer(
          'pipe',
          'dev',
          'app',
          'pod',
          'cont',
          'ls',
          user,
          mockUSerGroups,
        ),
      ).resolves.toBeUndefined();
    });

    it('should not execute if KUBERO_READONLY is true', async () => {
      process.env.KUBERO_READONLY = 'true';
      await expect(
        service.execInContainer(
          'pipe',
          'dev',
          'app',
          'pod',
          'cont',
          'ls',
          user,
          mockUSerGroups,
        ),
      ).resolves.toBeUndefined();
      delete process.env.KUBERO_READONLY;
    });

    it('should not execute if execStream already running and open', async () => {
      mockEventsGateway.execStreams['pipe-dev-app-pod-cont-terminal'] = {
        websocket: { readyState: 1, OPEN: 1 },
        stream: {},
      };
      await expect(
        service.execInContainer(
          'pipe',
          'dev',
          'app',
          'pod',
          'cont',
          'ls',
          user,
          mockUSerGroups,
        ),
      ).resolves.toBeUndefined();
    });

    it('should not set execStream if ws is undefined or not open', async () => {
      mockKubernetesService.execInContainer.mockResolvedValue(undefined);
      await expect(
        service.execInContainer(
          'pipe',
          'dev',
          'app',
          'pod',
          'cont',
          'ls',
          user,
          mockUSerGroups,
        ),
      ).resolves.toBeUndefined();
    });
    it('should set execStream and handle ws message', async () => {
      const wsOnMock = jest.fn((event, cb) => {
        if (event === 'message') {
          cb(Buffer.from('test'));
        }
      });
      const wsMock = { readyState: 1, OPEN: 1, on: wsOnMock };
      mockKubernetesService.execInContainer.mockResolvedValue(wsMock);

      await service.execInContainer(
        'pipe',
        'dev',
        'app',
        'pod',
        'cont',
        'ls',
        user,
        mockUSerGroups,
      );

      const streamname = 'pipe-dev-app-pod-cont-terminal';
      expect(mockEventsGateway.execStreams[streamname]).toBeDefined();
      expect(wsOnMock).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockEventsGateway.sendTerminalLine).toHaveBeenCalledWith(
        streamname,
        'test',
      );
    });
  });

  describe('AppsService - countApps', () => {
    let service: AppsService;
    let mockKubectl: any;

    beforeEach(() => {
      mockKubectl = {
        getCurrentContext: jest.fn(),
        getAllAppsList: jest.fn(),
      };

      service = new AppsService(
        mockKubectl,
        {} as any, // PipelinesService
        {} as any, // NotificationsService
        {} as any, // ConfigService
        {} as any, // EventsGateway
      );
    });

    it('should return the number of apps', async () => {
      mockKubectl.getCurrentContext.mockReturnValue('test-context');
      mockKubectl.getAllAppsList.mockResolvedValue({ items: [{}, {}, {}] });

      const result = await service.countApps();
      expect(mockKubectl.getCurrentContext).toHaveBeenCalled();
      expect(mockKubectl.getAllAppsList).toHaveBeenCalledWith('test-context');
      expect(result).toBe(3);
    });

    it('should return 0 if no items', async () => {
      mockKubectl.getCurrentContext.mockReturnValue('test-context');
      mockKubectl.getAllAppsList.mockResolvedValue({ items: [] });

      const result = await service.countApps();
      expect(result).toBe(0);
    });

    it('should throw if getAllAppsList fails', async () => {
      mockKubectl.getCurrentContext.mockReturnValue('test-context');
      mockKubectl.getAllAppsList.mockRejectedValue(new Error('fail'));

      await expect(service.countApps()).rejects.toThrow('fail');
    });
  });

  describe('AppsService - triggerImageBuildDelayed', () => {
    let service: AppsService;

    beforeEach(() => {
      service = new AppsService(
        {} as any, // kubectl
        {} as any, // pipelinesService
        {} as any, // NotificationsService
        {} as any, // configService
        {} as any, // eventsGateway
      );
      jest.spyOn(service, 'triggerImageBuild').mockResolvedValue({
        status: 'ok',
        message: 'build started',
        deploymentstrategy: 'git',
        pipeline: 'pipe',
        phase: 'dev',
        app: 'app1',
      });
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('should wait 2 seconds and then call triggerImageBuild', async () => {
      const promise = service['triggerImageBuildDelayed'](
        'pipe',
        'dev',
        'app1',
        mockUSerGroups,
      );
      // Fast-forward time by 2 seconds
      jest.advanceTimersByTime(2000);
      const result = await promise;
      expect(service.triggerImageBuild).toHaveBeenCalledWith(
        'pipe',
        'dev',
        'app1',
        ['group1', 'group2'],
      );
      expect(result).toEqual({
        app: 'app1',
        deploymentstrategy: 'git',
        message: 'build started',
        phase: 'dev',
        pipeline: 'pipe',
        status: 'ok',
      });
    });
  });

  describe('AppsService - deletePRApp', () => {
    let service: AppsService;
    let mockGetAllAppsList: jest.Mock;
    let mockDeleteApp: jest.Mock;
    let mockLogger: any;

    beforeEach(() => {
      mockGetAllAppsList = jest.fn();
      mockDeleteApp = jest.fn();
      mockLogger = { debug: jest.fn() };

      service = new AppsService(
        {} as any, // kubectl
        {} as any, // pipelinesService
        {} as any, // NotificationsService
        {} as any, // configService
        {} as any, // eventsGateway
      );
      // Methoden ersetzen
      service.getAllAppsList = mockGetAllAppsList;
      service.deleteApp = mockDeleteApp;
      service['logger'] = mockLogger;
    });

    it('should call deleteApp for matching PR apps', async () => {
      mockGetAllAppsList.mockResolvedValue([
        {
          phase: 'review',
          gitrepo: { ssh_url: 'git@github.com:foo/bar.git' },
          branch: 'feature-1',
          pipeline: 'pipeline1',
        },
        {
          phase: 'dev',
          gitrepo: { ssh_url: 'git@github.com:foo/bar.git' },
          branch: 'feature-1',
          pipeline: 'pipeline2',
        },
        {
          phase: 'review',
          gitrepo: { ssh_url: 'git@github.com:foo/bar.git' },
          branch: 'feature-2',
          pipeline: 'pipeline3',
        },
      ]);

      await service.deletePRApp(
        'feature-1',
        'My PR Title',
        'git@github.com:foo/bar.git',
        mockUSerGroups,
      );

      // Erwartet: Nur das erste App-Objekt passt auf alle Kriterien
      expect(mockDeleteApp).toHaveBeenCalledTimes(1);
      expect(mockDeleteApp).toHaveBeenCalledWith(
        'pipeline1',
        'review',
        'my-pr-title', // websaveTitle
        { username: 'unknown' },
        ['group1', 'group2'],
      );
    });

    it('should not call deleteApp if no app matches', async () => {
      mockGetAllAppsList.mockResolvedValue([
        {
          phase: 'dev',
          gitrepo: { ssh_url: 'git@github.com:foo/bar.git' },
          branch: 'feature-1',
          pipeline: 'pipeline1',
        },
      ]);
      await service.deletePRApp(
        'feature-2',
        'Other Title',
        'git@github.com:foo/bar.git',
        mockUSerGroups,
      );
      expect(mockDeleteApp).not.toHaveBeenCalled();
    });

    it('should call getAllAppsList with correct context', async () => {
      mockGetAllAppsList.mockResolvedValue([]);
      process.env.KUBERO_CONTEXT = 'my-context';
      await service.deletePRApp(
        'feature-1',
        'My PR Title',
        'git@github.com:foo/bar.git',
        mockUSerGroups,
      );
      expect(mockGetAllAppsList).toHaveBeenCalledWith('my-context');
      delete process.env.KUBERO_CONTEXT;
    });

    it('should log debug message', async () => {
      mockGetAllAppsList.mockResolvedValue([]);
      await service.deletePRApp(
        'feature-1',
        'My PR Title',
        'git@github.com:foo/bar.git',
        mockUSerGroups,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('destroyPRApp');
    });
  });

  describe('AppsService - createPRApp', () => {
    let service: AppsService;
    let mockPipelinesService: any;
    let mockConfigService: any;
    let mockKubectl: any;
    let mockNotificationsService: any;

    beforeEach(() => {
      process.env.KUBERO_READONLY = 'false';
      process.env.INGRESS_CLASSNAME = 'test-nginx';

      mockPipelinesService = {
        listPipelines: jest.fn(),
        getContext: jest.fn(),
      };

      mockConfigService = {
        getPodSizes: jest.fn().mockResolvedValue([podsize]),
      };

      mockKubectl = {};

      mockNotificationsService = {
        send: jest.fn(),
      };

      service = new AppsService(
        mockKubectl,
        mockPipelinesService,
        mockNotificationsService,
        mockConfigService,
        {} as any,
      );

      service.createApp = jest.fn().mockResolvedValue(undefined);
      service['logger'] = { debug: jest.fn() } as any;
    });

    it('should return early if KUBERO_READONLY is true', async () => {
      process.env.KUBERO_READONLY = 'true';

      const result = await service.createPRApp(
        'feature-branch',
        'PR Title',
        'git@github.com:org/repo.git',
        undefined,
        mockUSerGroups,
      );

      expect(result).toBeUndefined();
      expect(service.createApp).not.toHaveBeenCalled();
    });

    it('should create an app in matching pipeline with reviewapps enabled', async () => {
      const mockPipelines = {
        items: [
          {
            name: 'pipeline1',
            reviewapps: false,
            git: { repository: { ssh_url: 'git@github.com:org/repo.git' } },
          },
          {
            name: 'pipeline2',
            reviewapps: true,
            git: { repository: { ssh_url: 'git@github.com:org/repo.git' } },
            phases: [
              {
                name: 'review',
                domain: 'example.com',
                defaultEnvvars: [{ name: 'VAR', value: 'value' }],
              },
            ],
            buildpack: { name: 'nodejs', fetch: {}, build: {}, run: {} },
            deploymentstrategy: 'git',
            dockerimage: 'node:14',
          },
          {
            name: 'pipeline3',
            reviewapps: true,
            git: {
              repository: { ssh_url: 'git@github.com:org/different-repo.git' },
            },
          },
        ],
      };

      mockPipelinesService.listPipelines.mockResolvedValue(mockPipelines);

      const result = await service.createPRApp(
        'feature-branch',
        'PR Title',
        'git@github.com:org/repo.git',
        undefined,
        mockUSerGroups,
      );

      expect(result).toEqual({ status: 'ok', message: 'app created pr-title' });
      expect(service.createApp).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'pr-title',
          pipeline: 'pipeline2',
          phase: 'review',
          branch: 'feature-branch',
          gitrepo: { ssh_url: 'git@github.com:org/repo.git' },
          ingress: expect.objectContaining({
            enabled: true,
            className: 'test-nginx',
            hosts: [
              expect.objectContaining({
                host: 'pr-title.example.com',
              }),
            ],
          }),
        }),
        expect.objectContaining({ username: 'unknown' }),
        ['group1', 'group2'],
      );
    });

    it('should filter by pipelineName if provided', async () => {
      const mockPipelines = {
        items: [
          {
            name: 'pipeline1',
            reviewapps: true,
            git: { repository: { ssh_url: 'git@github.com:org/repo.git' } },
            phases: [
              { name: 'review', domain: 'example1.com', defaultEnvvars: [] },
            ],
            buildpack: { name: 'nodejs', fetch: {}, build: {}, run: {} },
            deploymentstrategy: 'git',
            dockerimage: 'node:14',
          },
          {
            name: 'pipeline2',
            reviewapps: true,
            git: { repository: { ssh_url: 'git@github.com:org/repo.git' } },
            phases: [
              { name: 'review', domain: 'example2.com', defaultEnvvars: [] },
            ],
            buildpack: { name: 'nodejs', fetch: {}, build: {}, run: {} },
            deploymentstrategy: 'git',
            dockerimage: 'node:14',
          },
        ],
      };

      mockPipelinesService.listPipelines.mockResolvedValue(mockPipelines);

      await service.createPRApp(
        'feature-branch',
        'PR Title',
        'git@github.com:org/repo.git',
        'pipeline2',
        mockUSerGroups,
      );

      expect(service.createApp).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'pr-title',
          pipeline: 'pipeline2',
        }),
        expect.anything(),
        ['group1', 'group2'],
      );
    });

    it('should not create an app if no matching pipeline is found', async () => {
      const mockPipelines = {
        items: [
          {
            name: 'pipeline1',
            reviewapps: false,
            git: { repository: { ssh_url: 'git@github.com:org/repo.git' } },
          },
          {
            name: 'pipeline2',
            reviewapps: true,
            git: {
              repository: { ssh_url: 'git@github.com:org/different-repo.git' },
            },
          },
        ],
      };

      mockPipelinesService.listPipelines.mockResolvedValue(mockPipelines);

      const result = await service.createPRApp(
        'feature-branch',
        'PR Title',
        'git@github.com:org/repo.git',
        undefined,
        mockUSerGroups,
      );

      expect(result).toBeUndefined();
      expect(service.createApp).not.toHaveBeenCalled();
    });

    it('should create app with sanitized name from title', async () => {
      const mockPipelines = {
        items: [
          {
            name: 'pipeline1',
            reviewapps: true,
            git: { repository: { ssh_url: 'git@github.com:org/repo.git' } },
            phases: [
              { name: 'review', domain: 'example.com', defaultEnvvars: [] },
            ],
            buildpack: { name: 'nodejs', fetch: {}, build: {}, run: {} },
            deploymentstrategy: 'git',
            dockerimage: 'node:14',
          },
        ],
      };

      mockPipelinesService.listPipelines.mockResolvedValue(mockPipelines);

      await service.createPRApp(
        'feature-branch',
        'Complex PR Title with 123 Special @#$ Characters!',
        'git@github.com:org/repo.git',
        undefined,
        mockUSerGroups,
      );

      expect(service.createApp).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'complex-pr-title-with-123-special-----characters-',
        }),
        expect.anything(),
        ['group1', 'group2'],
      );
    });
  });

  describe('getTemplate', () => {
    let service: AppsService;
    let mockGetApp: jest.Mock;
    let mockYAML: any;

    beforeEach(() => {
      mockGetApp = jest.fn();
      mockYAML = {
        stringify: jest.fn().mockReturnValue('yaml-output'),
      };

      service = new AppsService(
        {} as any, // kubectl
        {} as any, // pipelinesService
        {} as any, // NotificationsService
        {} as any, // ConfigService
        {} as any, // eventsGateway
      );

      // Override the methods and properties
      service.getApp = mockGetApp;
      service['YAML'] = mockYAML;
    });

    it('should return a YAML template for an app', async () => {
      mockGetApp.mockResolvedValue(mockKubectlApp);

      const result = await service.getTemplate(
        'pipeline1',
        'dev',
        'test-app',
        mockUSerGroups,
      );

      expect(mockGetApp).toHaveBeenCalledWith('pipeline1', 'dev', 'test-app', [
        'group1',
        'group2',
      ]);
      expect(mockYAML.stringify).toHaveBeenCalledWith(expect.any(Object), {
        indent: 4,
        resolveKnownTags: true,
      });
      expect(result).toBe('yaml-output');
    });
  });

  describe('AppsService - restartApp', () => {
    let service: AppsService;
    let mockKubectl: any;
    let mockPipelinesService: any;
    let mockNotificationsService: any;
    let mockLogger: any;

    beforeEach(() => {
      mockKubectl = {
        restartApp: jest.fn(),
      };
      mockPipelinesService = {
        getContext: jest.fn().mockResolvedValue('test-context'),
      };
      mockNotificationsService = {
        send: jest.fn(),
      };
      mockLogger = { debug: jest.fn() };

      service = new AppsService(
        mockKubectl,
        mockPipelinesService,
        mockNotificationsService,
        {} as any, // configService
        {} as any, // eventsGateway
      );
      service['logger'] = mockLogger;
    });

    afterEach(() => {
      delete process.env.KUBERO_READONLY;
      jest.clearAllMocks();
    });

    it('should not restart app if KUBERO_READONLY is true', async () => {
      process.env.KUBERO_READONLY = 'true';
      const user = { id: '1', username: 'testuser' };
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await service.restartApp(
        'pipe',
        'dev',
        'app1',
        user as any,
        mockUSerGroups,
      );
      expect(mockKubectl.restartApp).not.toHaveBeenCalled();
      expect(mockNotificationsService.send).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should call restartApp for web and worker and send notification', async () => {
      const user = { id: '1', username: 'testuser' };
      await service.restartApp(
        'pipe',
        'dev',
        'app1',
        user as any,
        mockUSerGroups,
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'restart App: app1 in pipe phase: dev',
      );
      expect(mockPipelinesService.getContext).toHaveBeenCalledWith(
        'pipe',
        'dev',
        ['group1', 'group2'],
      );
      expect(mockKubectl.restartApp).toHaveBeenCalledWith(
        'pipe',
        'dev',
        'app1',
        'web',
        'test-context',
      );
      expect(mockKubectl.restartApp).toHaveBeenCalledWith(
        'pipe',
        'dev',
        'app1',
        'worker',
        'test-context',
      );
      expect(mockNotificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'restartApp',
          user: '1',
          resource: 'app',
          action: 'restart',
          pipelineName: 'pipe',
          phaseName: 'dev',
          appName: 'app1',
        }),
      );
    });

    it('should do nothing if getContext returns undefined', async () => {
      mockPipelinesService.getContext.mockResolvedValueOnce(undefined);
      const user = { id: '1', username: 'testuser' };
      await service.restartApp(
        'pipe',
        'dev',
        'app1',
        user as any,
        mockUSerGroups,
      );
      expect(mockKubectl.restartApp).not.toHaveBeenCalled();
      expect(mockNotificationsService.send).not.toHaveBeenCalled();
    });
  });

  describe('AppsService - getPods', () => {
    let service: AppsService;
    let mockKubectl: any;
    let mockPipelinesService: any;

    beforeEach(() => {
      mockKubectl = {
        setCurrentContext: jest.fn(),
        getPods: jest.fn(),
      };
      mockPipelinesService = {
        getContext: jest.fn(),
      };

      service = new AppsService(
        mockKubectl,
        mockPipelinesService,
        {} as any, // NotificationsService
        {} as any, // ConfigService
        {} as any, // EventsGateway
      );
    });

    it('should return empty array if no context is found', async () => {
      mockPipelinesService.getContext.mockResolvedValue(undefined);
      const result = await service.getPods(
        'pipe',
        'dev',
        'app1',
        mockUSerGroups,
      );
      expect(result).toEqual([]);
      expect(mockKubectl.setCurrentContext).not.toHaveBeenCalled();
      expect(mockKubectl.getPods).not.toHaveBeenCalled();
    });

    it('should return filtered workloads with containers', async () => {
      mockPipelinesService.getContext.mockResolvedValue('test-context');
      mockKubectl.getPods.mockResolvedValue([
        {
          metadata: {
            name: 'pod-1',
            namespace: 'pipe-dev',
            generateName: 'app1-kuberoapp-',
            creationTimestamp: '2024-01-01T00:00:00Z',
          },
          status: {
            phase: 'Running',
            startTime: '2024-01-01T00:00:00Z',
            containerStatuses: [
              { restartCount: 1, ready: true, started: true },
              { restartCount: 0, ready: false, started: false },
            ],
          },
          spec: {
            containers: [
              { name: 'web', image: 'nginx:latest' },
              { name: 'worker', image: 'node:18' },
            ],
          },
        },
        {
          metadata: {
            name: 'pod-2',
            namespace: 'pipe-dev',
            generateName: 'otherapp-kuberoapp-',
            creationTimestamp: '2024-01-01T01:00:00Z',
          },
          status: {
            phase: 'Pending',
            startTime: '2024-01-01T01:00:00Z',
            containerStatuses: [],
          },
          spec: {
            containers: [],
          },
        },
      ]);

      const result = await service.getPods(
        'pipe',
        'dev',
        'app1',
        mockUSerGroups,
      );
      expect(mockPipelinesService.getContext).toHaveBeenCalledWith(
        'pipe',
        'dev',
        ['group1', 'group2'],
      );
      expect(mockKubectl.getPods).toHaveBeenCalledWith(
        'pipe-dev',
        'test-context',
      );
      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject({
        name: 'pod-1',
        namespace: 'pipe-dev',
        phase: 'dev',
        pipeline: 'pipe',
        status: 'Running',
        age: '2024-01-01T00:00:00Z',
        startTime: '2024-01-01T00:00:00Z',
        containers: [
          {
            name: 'web',
            image: 'nginx:latest',
            restartCount: 1,
            ready: true,
            started: true,
          },
          {
            name: 'worker',
            image: 'node:18',
            restartCount: 0,
            ready: false,
            started: false,
          },
        ],
      });
    });

    it('should skip pods whose generateName does not match', async () => {
      mockPipelinesService.getContext.mockResolvedValue('test-context');
      mockKubectl.getPods.mockResolvedValue([
        {
          metadata: {
            name: 'pod-2',
            namespace: 'pipe-dev',
            generateName: 'otherapp-kuberoapp-',
            creationTimestamp: '2024-01-01T01:00:00Z',
          },
          status: {
            phase: 'Pending',
            startTime: '2024-01-01T01:00:00Z',
            containerStatuses: [],
          },
          spec: {
            containers: [],
          },
        },
      ]);
      const result = await service.getPods(
        'pipe',
        'dev',
        'app1',
        mockUSerGroups,
      );
      expect(result).toEqual([]);
    });
  });
});
