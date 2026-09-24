import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsDbService } from './notifications-db.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { INotificationConfig } from './notifications.interface';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsDbService>;

  const mockNotificationConfig: INotificationConfig = {
    id: '123',
    name: 'Test Notification',
    enabled: true,
    type: 'slack',
    pipelines: ['pipeline1', 'pipeline2'],
    events: ['deploy', 'build'],
    config: {
      url: 'https://hooks.slack.com/test',
      channel: '#general',
    },
  };

  const mockNotificationDb = {
    id: '123',
    name: 'Test Notification',
    enabled: true,
    type: 'slack' as const,
    pipelines: '["pipeline1", "pipeline2"]',
    events: '["deploy", "build"]',
    webhookUrl: null,
    webhookSecret: null,
    slackUrl: 'https://hooks.slack.com/test',
    slackChannel: '#general',
    discordUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      getNotificationConfigs: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      toNotificationConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsDbService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get(NotificationsDbService);
  });

  const adminReq = { user: { permissions: ['config:write', 'config:read'] } };
  const readerReq = { user: { permissions: ['config:read'] } };

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('credentials', () => {
    const secretNotification: any = {
      ...mockNotificationConfig,
      type: 'webhook',
      config: {
        url: 'https://hooks.example/abc',
        secret: 's3cret',
        foo: 'bar',
      },
    };

    it('shows the url and secret to whoever has config:write', async () => {
      service.getNotificationConfigs.mockResolvedValue([secretNotification]);
      const result = await controller.findAll(adminReq);
      expect(result.data?.[0].config).toMatchObject({
        url: 'https://hooks.example/abc',
        secret: 's3cret',
      });
    });

    it('hides the url and secret from a config:read-only user', async () => {
      service.getNotificationConfigs.mockResolvedValue([secretNotification]);
      const result = await controller.findAll(readerReq);
      const config: any = result.data?.[0].config;
      expect(config.url).toBe('********');
      expect(config.secret).toBe('********');
      expect(config.foo).toBe('bar');
      expect(JSON.stringify(result)).not.toContain('s3cret');
      expect(JSON.stringify(result)).not.toContain('hooks.example');
    });

    it('also hides them when fetching a single notification', async () => {
      service.findById.mockResolvedValue(mockNotificationDb);
      service.toNotificationConfig.mockReturnValue(secretNotification);
      const result = await controller.findOne('1', readerReq);
      expect(JSON.stringify(result)).not.toContain('s3cret');
    });

    it('hides them when the request carries no permissions at all', async () => {
      service.getNotificationConfigs.mockResolvedValue([secretNotification]);
      const result = await controller.findAll({});
      expect(JSON.stringify(result)).not.toContain('s3cret');
    });
  });

  describe('findAll', () => {
    it('should return all notifications successfully', async () => {
      const mockNotifications = [mockNotificationConfig];
      service.getNotificationConfigs.mockResolvedValue(mockNotifications);

      const result = await controller.findAll(adminReq);

      expect(result).toEqual({
        success: true,
        data: mockNotifications,
      });
      expect(service.getNotificationConfigs).toHaveBeenCalledTimes(1);
    });

    it('should throw HttpException when service fails', async () => {
      service.getNotificationConfigs.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.findAll(adminReq)).rejects.toThrow(
        new HttpException(
          'Failed to fetch notifications',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('findOne', () => {
    const notificationId = '123';

    it('should return a notification by id successfully', async () => {
      service.findById.mockResolvedValue(mockNotificationDb);
      service.toNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await controller.findOne(notificationId, adminReq);

      expect(result).toEqual({
        success: true,
        data: mockNotificationConfig,
      });
      expect(service.findById).toHaveBeenCalledWith(notificationId);
      expect(service.toNotificationConfig).toHaveBeenCalledWith(
        mockNotificationDb,
      );
    });

    it('should throw NotFound when notification does not exist', async () => {
      service.findById.mockResolvedValue(null);

      await expect(
        controller.findOne(notificationId, adminReq),
      ).rejects.toThrow(
        new HttpException('Notification not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should re-throw HttpException from service', async () => {
      const httpError = new HttpException(
        'Service error',
        HttpStatus.BAD_REQUEST,
      );
      service.findById.mockRejectedValue(httpError);

      await expect(
        controller.findOne(notificationId, adminReq),
      ).rejects.toThrow(httpError);
    });

    it('should throw Internal Server Error for other errors', async () => {
      service.findById.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.findOne(notificationId, adminReq),
      ).rejects.toThrow(
        new HttpException(
          'Failed to fetch notification',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('create', () => {
    const createDto: CreateNotificationDto = {
      name: 'New Notification',
      enabled: true,
      type: 'slack',
      pipelines: ['pipeline1'],
      events: ['deploy'],
      config: {
        url: 'https://hooks.slack.com/test',
        channel: '#general',
      },
    };

    it('should create a notification successfully', async () => {
      service.create.mockResolvedValue(mockNotificationDb);
      service.toNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await controller.create(createDto);

      expect(result).toEqual({
        success: true,
        data: mockNotificationConfig,
        message: 'Notification created successfully',
      });
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should re-throw HttpException from service', async () => {
      const httpError = new HttpException(
        'Service error',
        HttpStatus.BAD_REQUEST,
      );
      service.create.mockRejectedValue(httpError);

      await expect(controller.create(createDto)).rejects.toThrow(httpError);
    });

    it('should throw Internal Server Error for other errors', async () => {
      service.create.mockRejectedValue(new Error('Database error'));

      await expect(controller.create(createDto)).rejects.toThrow(
        new HttpException(
          'Failed to create notification',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('update', () => {
    const notificationId = '123';
    const updateDto: Partial<CreateNotificationDto> = {
      name: 'Updated Notification',
      enabled: false,
    };

    it('should update a notification successfully', async () => {
      const updatedNotificationDb = {
        ...mockNotificationDb,
        name: updateDto.name || mockNotificationDb.name,
        enabled:
          updateDto.enabled !== undefined
            ? updateDto.enabled
            : mockNotificationDb.enabled,
      };
      const updatedNotificationConfig = {
        ...mockNotificationConfig,
        name: updateDto.name || mockNotificationConfig.name,
        enabled:
          updateDto.enabled !== undefined
            ? updateDto.enabled
            : mockNotificationConfig.enabled,
      };

      service.findById.mockResolvedValue(mockNotificationDb);
      service.update.mockResolvedValue(updatedNotificationDb);
      service.toNotificationConfig.mockReturnValue(updatedNotificationConfig);

      const result = await controller.update(notificationId, updateDto);

      expect(result).toEqual({
        success: true,
        data: updatedNotificationConfig,
        message: 'Notification updated successfully',
      });
      expect(service.findById).toHaveBeenCalledWith(notificationId);
      expect(service.update).toHaveBeenCalledWith(notificationId, updateDto);
    });

    it('should throw NotFound when notification does not exist', async () => {
      service.findById.mockResolvedValue(null);

      await expect(
        controller.update(notificationId, updateDto),
      ).rejects.toThrow(
        new HttpException('Notification not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should re-throw HttpException from service', async () => {
      const httpError = new HttpException(
        'Service error',
        HttpStatus.BAD_REQUEST,
      );
      service.findById.mockResolvedValue(mockNotificationDb);
      service.update.mockRejectedValue(httpError);

      await expect(
        controller.update(notificationId, updateDto),
      ).rejects.toThrow(httpError);
    });

    it('should throw Internal Server Error for other errors', async () => {
      service.findById.mockResolvedValue(mockNotificationDb);
      service.update.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.update(notificationId, updateDto),
      ).rejects.toThrow(
        new HttpException(
          'Failed to update notification',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('remove', () => {
    const notificationId = '123';

    it('should delete a notification successfully', async () => {
      service.delete.mockResolvedValue(undefined);

      const result = await controller.remove(notificationId);

      expect(result).toEqual({
        success: true,
        message: 'Notification deleted successfully',
      });
      expect(service.delete).toHaveBeenCalledWith(notificationId);
    });

    it('should throw NotFound when notification does not exist', async () => {
      service.delete.mockRejectedValue(new Error('Notification not found'));

      await expect(controller.remove(notificationId)).rejects.toThrow(
        new HttpException('Notification not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw Internal Server Error for other errors', async () => {
      service.delete.mockRejectedValue(new Error('Database error'));

      await expect(controller.remove(notificationId)).rejects.toThrow(
        new HttpException(
          'Failed to delete notification',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });
});
