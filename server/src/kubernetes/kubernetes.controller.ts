import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { KubernetesService } from './kubernetes.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import {
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  StorageClassDTO,
  ContextDTO,
  GetEventsDTO,
} from './dto/kubernetes.dto';
import { OKDTO } from '../common/dto/ok.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller({ path: 'api/kubernetes', version: '1' })
export class KubernetesController {
  constructor(
    private readonly kubernetesService: KubernetesService,
    private readonly pipelinesService: PipelinesService,
  ) {}

  @Get('events')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('app:read', 'app:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiResponse({
    status: 200,
    description: 'List of available contexts',
    type: GetEventsDTO,
    isArray: true,
  })
  @ApiOperation({
    summary: 'Get the Kubernetes events in a specific namespace',
  })
  async getEvents(@Query('namespace') namespace: string, @Request() req: any) {
    // Antes cualquier usuario podía leer los eventos de cualquier namespace del
    // cluster. Solo el equipo admin puede pedir uno arbitrario; el resto, solo
    // los namespaces (<pipeline>-<fase>) de los pipelines a los que tiene acceso.
    const userGroups: string[] = req.user.userGroups ?? [];
    if (!userGroups.includes('admin')) {
      const pipelines = await this.pipelinesService.listPipelines(userGroups);
      let context: string | undefined;
      let allowed = false;
      for (const pipeline of pipelines.items) {
        for (const phase of pipeline.phases) {
          if (`${pipeline.name}-${phase.name}` === namespace) {
            allowed = true;
            context = phase.context;
          }
        }
      }
      if (!allowed) {
        throw new ForbiddenException('No access to this namespace');
      }
      if (context) {
        this.kubernetesService.setCurrentContext(context);
      }
    }
    return this.kubernetesService.getEvents(namespace);
  }

  @Get('storageclasses')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('app:read', 'app:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'A List of available storage classes',
    type: StorageClassDTO,
    isArray: true,
  })
  @ApiOperation({ summary: 'Get the available storage classes' })
  async getStorageClasses(): Promise<StorageClassDTO[]> {
    return this.kubernetesService.getStorageClasses();
  }

  @Get('domains')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('app:read', 'app:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'Already taken domains',
    type: [String],
    isArray: true,
  })
  @ApiOperation({
    summary: 'Get a list of allredy taken domains on this Kubernets cluster',
  })
  async getDomains(): Promise<string[]> {
    return this.kubernetesService.getDomains();
  }

  @Get('/contexts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pipeline:write')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiBearerAuth('bearerAuth')
  @ApiOkResponse({
    description: 'A List of available contexts',
    type: ContextDTO,
    isArray: true,
  })
  @ApiOperation({ summary: 'Get available contexts' })
  async getContexts(): Promise<ContextDTO[]> {
    return this.kubernetesService.getContexts();
  }
}
