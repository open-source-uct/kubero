import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationsDbService } from './notifications-db.service';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
} from './dto/notification.dto';
import { INotificationConfig } from './notifications.interface';
import { JwtAuthGuard } from '../auth/strategies/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ReadonlyGuard } from '../common/guards/readonly.guard';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// Estas rutas guardan URLs y secretos de Slack/webhook/Discord: antes no tenían
// ningún guard y cualquiera, sin sesión, podía leerlas y modificarlas.
@Controller('api/notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationsDbService: NotificationsDbService,
  ) {}

  // Las URLs de Slack/Discord/webhook y el secreto del webhook son credenciales:
  // quien solo tiene config:read (por ejemplo un rol de estudiante) ve que la
  // notificación existe pero no esos valores.
  private redact(n: INotificationConfig, req: any): INotificationConfig {
    const permissions: string[] = req?.user?.permissions ?? [];
    if (permissions.includes('config:write')) {
      return n;
    }
    const config: any = { ...(n.config as any) };
    for (const key of ['url', 'secret']) {
      if (config[key]) {
        config[key] = '********';
      }
    }
    return { ...n, config };
  }

  @Get()
  @Permissions('config:read', 'config:write')
  async findAll(
    @Request() req: any,
  ): Promise<ApiResponse<INotificationConfig[]>> {
    try {
      const notifications =
        await this.notificationsDbService.getNotificationConfigs();
      return {
        success: true,
        data: notifications.map((n) => this.redact(n, req)),
      };
    } catch (error) {
      this.logger.error('Failed to fetch notifications', error);
      throw new HttpException(
        'Failed to fetch notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @Permissions('config:read', 'config:write')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<ApiResponse<INotificationConfig>> {
    try {
      const notification = await this.notificationsDbService.findById(id);
      if (!notification) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: this.redact(
          this.notificationsDbService.toNotificationConfig(notification),
          req,
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch notification ${id}`, error);
      throw new HttpException(
        'Failed to fetch notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @Permissions('config:write')
  @UseGuards(ReadonlyGuard)
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<ApiResponse<INotificationConfig>> {
    try {
      const notification = await this.notificationsDbService.create(
        createNotificationDto,
      );

      return {
        success: true,
        data: this.notificationsDbService.toNotificationConfig(notification),
        message: 'Notification created successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to create notification', error);
      throw new HttpException(
        'Failed to create notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @Permissions('config:write')
  @UseGuards(ReadonlyGuard)
  async update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ): Promise<ApiResponse<INotificationConfig>> {
    try {
      const existingNotification =
        await this.notificationsDbService.findById(id);
      if (!existingNotification) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }

      const notification = await this.notificationsDbService.update(
        id,
        updateNotificationDto,
      );

      return {
        success: true,
        data: this.notificationsDbService.toNotificationConfig(notification),
        message: 'Notification updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to update notification ${id}`, error);
      throw new HttpException(
        'Failed to update notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @Permissions('config:write')
  @UseGuards(ReadonlyGuard)
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    try {
      await this.notificationsDbService.delete(id);

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }
      this.logger.error(`Failed to delete notification ${id}`, error);
      throw new HttpException(
        'Failed to delete notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
