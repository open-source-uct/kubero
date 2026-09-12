import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsIn,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';

class NotificationConfigDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsString()
  channel?: string;
}

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  enabled: boolean;

  @IsIn(['slack', 'webhook', 'discord'])
  type: 'slack' | 'webhook' | 'discord';

  @IsArray()
  @IsString({ each: true })
  pipelines: string[];

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ValidateNested()
  @Type(() => NotificationConfigDto)
  config: NotificationConfigDto;
}

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}
