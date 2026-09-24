import { NotificationsService } from './notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import { KubernetesService } from '../kubernetes/kubernetes.service';
import { NotificationsDbService } from './notifications-db.service';
import { INotification, INotificationConfig } from './notifications.interface';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ status: 200 })),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let eventsGateway: jest.Mocked<EventsGateway>;
  let auditService: jest.Mocked<AuditService>;
  let kubectl: jest.Mocked<KubernetesService>;
  let notificationsDbService: jest.Mocked<NotificationsDbService>;

  beforeEach(() => {
    eventsGateway = { sendEvent: jest.fn() } as any;
    auditService = { log: jest.fn() } as any;
    kubectl = { createEvent: jest.fn() } as any;
    notificationsDbService = {
      getNotificationConfigs: jest.fn().mockResolvedValue([]),
    } as any;

    service = new NotificationsService(
      eventsGateway,
      auditService,
      kubectl,
      notificationsDbService,
    );
    service.setConfig({
      notifications: [],
    } as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call sendWebsocketMessage, createKubernetesEvent, writeAuditLog, and sendAllCustomNotification on send', async () => {
    const message: INotification = {
      name: 'test',
      user: 'user',
      resource: 'app',
      action: 'create',
      severity: 'info',
      message: 'msg',
      phaseName: 'dev',
      pipelineName: 'pipe',
      appName: 'app',
      data: {},
    };
    const spy = jest.spyOn<any, any>(
      service as any,
      'sendAllCustomNotification',
    );
    await service.send(message);
    expect(eventsGateway.sendEvent).toHaveBeenCalled();
    expect(kubectl.createEvent).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalled();
    expect(notificationsDbService.getNotificationConfigs).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('should call send after delay in sendDelayed', () => {
    jest.useFakeTimers();
    const message = {
      name: 'test',
      user: 'user',
      resource: 'app',
      action: 'create',
      severity: 'info',
      message: 'msg',
      phaseName: 'dev',
      pipelineName: 'pipe',
      appName: 'app',
      data: {},
    } as INotification;
    const spy = jest.spyOn(service, 'send');
    service.sendDelayed(message);
    jest.runAllTimers();
    expect(spy).toHaveBeenCalledWith(message);
    jest.useRealTimers();
  });

  it('should send custom notifications for enabled configs and matching events/pipelines', () => {
    const slackConfig: INotificationConfig = {
      enabled: true,
      name: 'slack',
      type: 'slack',
      pipelines: ['pipe'],
      events: ['test'],
      config: { url: 'http://slack', channel: '#general' },
    };
    const webhookConfig: INotificationConfig = {
      enabled: true,
      name: 'webhook',
      type: 'webhook',
      pipelines: ['all'],
      events: ['test'],
      config: { url: 'http://webhook', secret: 'secret' },
    };
    const discordConfig: INotificationConfig = {
      enabled: true,
      name: 'discord',
      type: 'discord',
      pipelines: [],
      events: ['test'],
      config: { url: 'http://discord' },
    };
    service.setConfig({
      notifications: [slackConfig, webhookConfig, discordConfig],
    } as any);

    const spySlack = jest.spyOn<any, any>(
      service as any,
      'sendSlackNotification',
    );
    const spyWebhook = jest.spyOn<any, any>(
      service as any,
      'sendWebhookNotification',
    );
    const spyDiscord = jest.spyOn<any, any>(
      service as any,
      'sendDiscordNotification',
    );

    const message: INotification = {
      name: 'test',
      user: 'user',
      resource: 'app',
      action: 'create',
      severity: 'info',
      message: 'msg',
      phaseName: 'dev',
      pipelineName: 'pipe',
      appName: 'app',
      data: {},
    };

    (service as any).sendAllCustomNotification(
      service['config'].notifications,
      message,
    );

    expect(spySlack).toHaveBeenCalled();
    expect(spyWebhook).toHaveBeenCalled();
    expect(spyDiscord).toHaveBeenCalled();
  });

  it('should not send custom notification if notifications is undefined', () => {
    const spy = jest.spyOn<any, any>(service as any, 'sendCustomNotification');
    (service as any).sendAllCustomNotification(undefined, {} as INotification);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should call correct notification method in sendCustomNotification', () => {
    const message = {} as INotification;
    const slack = jest.spyOn<any, any>(service as any, 'sendSlackNotification');
    const webhook = jest.spyOn<any, any>(
      service as any,
      'sendWebhookNotification',
    );
    const discord = jest.spyOn<any, any>(
      service as any,
      'sendDiscordNotification',
    );

    (service as any).sendCustomNotification('slack', {}, message);
    (service as any).sendCustomNotification('webhook', {}, message);
    (service as any).sendCustomNotification('discord', {}, message);
    (service as any).sendCustomNotification('unknown', {}, message);

    expect(slack).toHaveBeenCalled();
    expect(webhook).toHaveBeenCalled();
    expect(discord).toHaveBeenCalled();
  });

  describe('who receives a websocket event', () => {
    const base: INotification = {
      name: 'deleteApp',
      user: 'u',
      resource: 'app',
      action: 'delete',
      severity: 'normal',
      message: 'm',
      phaseName: 'production',
      pipelineName: 'pipe',
      appName: 'app',
      data: {},
    };
    const sent = () => eventsGateway.sendEvent.mock.calls[0];

    beforeEach(() => {
      (kubectl as any).getPipeline = jest.fn();
    });

    it('sends events of a restricted pipeline only to its teams', async () => {
      (kubectl as any).getPipeline.mockResolvedValue({
        spec: { access: { teams: ['Taller1', 'Taller3'] } },
      });
      await service.send(base);
      expect(sent()[2]).toEqual(['Taller1', 'Taller3']);
    });

    it('uses the pipeline that comes in the event data without asking kubernetes', async () => {
      await service.send({
        ...base,
        data: { pipeline: { access: { teams: ['Taller2'] } } },
      });
      expect((kubectl as any).getPipeline).not.toHaveBeenCalled();
      expect(sent()[2]).toEqual(['Taller2']);
    });

    it('understands the kubernetes shape of the pipeline (spec.access)', async () => {
      await service.send({
        ...base,
        data: { pipeline: { spec: { access: { teams: ['Taller2'] } } } },
      });
      expect(sent()[2]).toEqual(['Taller2']);
    });

    it('ignores data.pipeline when it is only the name of the pipeline', async () => {
      (kubectl as any).getPipeline.mockResolvedValue({
        spec: { access: { teams: ['Taller1'] } },
      });
      await service.send({ ...base, data: { pipeline: 'pipe' } });
      expect((kubectl as any).getPipeline).toHaveBeenCalledWith('pipe');
      expect(sent()[2]).toEqual(['Taller1']);
    });

    it('sends to everyone when the pipeline has no access restriction', async () => {
      (kubectl as any).getPipeline.mockResolvedValue({ spec: {} });
      await service.send(base);
      expect(sent()[2]).toBeUndefined();
    });

    it('a pipeline with an empty team list is only for the admin team', async () => {
      (kubectl as any).getPipeline.mockResolvedValue({
        spec: { access: { teams: [] } },
      });
      await service.send(base);
      expect(sent()[2]).toEqual([]);
    });

    it('system events without pipeline go only to the admin team', async () => {
      await service.send({ ...base, name: 'updateSettings', pipelineName: '' });
      expect(sent()[2]).toEqual([]);
      expect((kubectl as any).getPipeline).not.toHaveBeenCalled();
    });

    it('fails closed (admin only) when the owner of the pipeline cannot be found', async () => {
      (kubectl as any).getPipeline.mockRejectedValue(new Error('not found'));
      await service.send(base);
      expect(sent()[2]).toEqual([]);
    });
  });
});
