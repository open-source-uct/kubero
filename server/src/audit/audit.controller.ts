import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { OKDTO } from '../common/dto/ok.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AuditQueryDto } from './audit-query.dto';
import { AuditSuggestionsDto } from './audit-suggestions.dto';

@Controller({ path: 'api/audit', version: '1' })
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly pipelinesService: PipelinesService,
  ) {}

  @Get('/suggestions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('audit:read', 'audit:write')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Suggest names from authorized audit entries only' })
  async getSuggestions(
    @Query() query: AuditSuggestionsDto,
    @Request() req: any,
  ) {
    const groups: string[] = req.user.userGroups ?? [];
    if (groups.includes('admin')) {
      return this.auditService.getSuggestions(query);
    }
    const accessible = await this.pipelinesService.listPipelines(groups);
    return this.auditService.getSuggestions(
      query,
      accessible.items.map((p) => p.name),
    );
  }

  @ApiOperation({ summary: 'Get all audit entries for a specific app' })
  @Get('/app/:pipeline/:phase/:app')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('audit:read', 'audit:write')
  @ApiBearerAuth('bearerAuth')
  async getAudit(
    @Param('pipeline') pipeline: string,
    @Param('phase') phase: string,
    @Param('app') app: string,
    @Query(
      'limit',
      new DefaultValuePipe('100'),
      new ParseIntPipe({ optional: true }),
    )
    limit: number,
    @Request() req: any,
  ) {
    // 403 si el usuario no tiene acceso al pipeline de la app
    await this.pipelinesService.getContext(
      pipeline,
      phase,
      req.user.userGroups,
    );
    return this.auditService.getAppEntries(pipeline, phase, app, limit);
  }

  @ApiOperation({ summary: 'Get all audit entries' })
  @Get('/')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('audit:read', 'audit:write')
  @ApiBearerAuth('bearerAuth')
  async getAuditAll(
    @Query(
      'limit',
      new DefaultValuePipe('100'),
      new ParseIntPipe({ optional: true }),
    )
    limit: number,
    @Request() req: any,
    @Query() filters: AuditQueryDto = {},
  ) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }
    if (
      filters.from &&
      filters.to &&
      new Date(filters.from) >= new Date(filters.to)
    ) {
      throw new BadRequestException('Start date must precede end date');
    }
    // El equipo admin ve todo el registro (incluye eventos de sistema sin
    // pipeline). El resto solo ve lo de los pipelines a los que tiene acceso:
    // antes cualquier usuario con audit:read veía la auditoría de todos.
    const userGroups: string[] = req.user.userGroups ?? [];
    if (userGroups.includes('admin')) {
      return this.auditService.get(limit, undefined, filters);
    }
    const accessible = await this.pipelinesService.listPipelines(userGroups);
    return this.auditService.get(
      limit,
      accessible.items.map((p) => p.name),
      filters,
    );
  }
}
