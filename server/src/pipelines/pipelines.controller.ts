import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PipelinesService } from './pipelines.service';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { CreatePipelineDTO } from './dto/replacePipeline.dto';
import { GetPipelineDTO } from './dto/getPipeline.dto';
import { OKDTO } from '../common/dto/ok.dto';
import { IUser } from '../auth/auth.interface';
import { IPipeline } from './pipelines.interface';
import { JwtAuthGuard } from '../auth/strategies/jwt.guard';
import { ReadonlyGuard } from '../common/guards/readonly.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller({ path: 'api/pipelines', version: '1' })
export class PipelinesController {
  constructor(private pipelinesService: PipelinesService) {}

  @Get('/')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pipeline:read', 'pipeline:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'A List of Pipelines',
    type: GetPipelineDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Get all pipelines' })
  async getPipelines(@Request() req: any) {
    return this.pipelinesService.listPipelines(req.user.userGroups);
  }

  @Post('/:pipeline')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pipeline:write')
  @UseGuards(ReadonlyGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'A List of Pipelines',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Create a new pipeline' })
  async createPipeline(
    @Param('pipeline') pipelineName: string,
    @Body() pl: CreatePipelineDTO,
    @Request() req: any,
  ): Promise<OKDTO> {
    if (pipelineName !== 'new') {
      const msg = 'Pipeline name does not match the URL';
      Logger.error(msg);
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
    this.assertTeamAccess(pl, req.user);
    const user: IUser = {
      id: req.user.userId,
      strategy: req.user.strategy,
      username: req.user.username,
    };

    const pipeline = this.toPipeline(pl);
    return this.pipelinesService.createPipeline(
      pipeline,
      user,
    ) as Promise<OKDTO>;
  }

  @Get('/:pipeline')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pipeline:read', 'pipeline:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Get a specific pipeline' })
  async getPipeline(@Param('pipeline') pipeline: string, @Request() req: any) {
    await this.assertPipelineAccess(pipeline, req.user);
    return this.pipelinesService.getPipeline(pipeline);
  }

  @Put('/:pipeline')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pipeline:write')
  @UseGuards(ReadonlyGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Update a pipeline' })
  async updatePipeline(
    @Body() pl: CreatePipelineDTO,
    @Request() req: any,
    @Param('pipeline') pipelineName: string,
  ) {
    await this.assertPipelineAccess(pipelineName, req.user);
    const current = await this.pipelinesService.getPipeline(pipelineName);
    this.assertTeamAccess(pl, req.user, current?.access?.teams ?? []);
    const user: IUser = {
      id: req.user.userId,
      strategy: req.user.strategy,
      username: req.user.username,
    };

    const pipeline = this.toPipeline(pl);
    return this.pipelinesService.updatePipeline(
      pipeline,
      pl.resourceVersion as string,
      user,
    );
  }

  @Delete('/:pipeline')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pipeline:write')
  @UseGuards(ReadonlyGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Delete a pipeline' })
  async deletePipeline(
    @Param('pipeline') pipeline: string,
    @Request() req: any,
  ): Promise<OKDTO> {
    await this.assertPipelineAccess(pipeline, req.user);
    const user: IUser = {
      id: req.user.userId,
      strategy: req.user.strategy,
      username: req.user.username,
    };
    await this.pipelinesService.deletePipeline(pipeline, user);
    return { status: 'ok', message: '' } as OKDTO;
  }

  @Get('/:pipeline/apps')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pipeline:read', 'pipeline:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Get all apps for a pipeline' })
  async getPipelineApps(
    @Param('pipeline') pipeline: string,
    @Request() req: any,
  ) {
    await this.assertPipelineAccess(pipeline, req.user);
    return this.pipelinesService.getPipelineWithApps(
      pipeline,
      req.user.userGroups,
    );
  }

  // Antes solo el listado (/api/pipelines) filtraba por equipo; ver, editar
  // y borrar una pipeline puntual por nombre no revisaban nada más que el
  // permiso del rol, así que cualquier usuario con pipeline:write podía
  // tocar la pipeline de cualquier otro equipo si sabía o adivinaba su nombre.
  private async assertPipelineAccess(
    pipelineName: string,
    user: { userGroups?: string[] },
  ) {
    const hasAccess = await this.pipelinesService.userHasAccessToPipeline(
      pipelineName,
      user.userGroups ?? [],
    );
    if (!hasAccess) {
      throw new ForbiddenException('No access to this pipeline');
    }
  }

  // Un pipeline con la lista de equipos vacía solo lo ven los admins (ver
  // getPipelinesList), así que un usuario no admin se quedaría sin acceso a su
  // propio pipeline.
  // Además, un usuario que no es admin solo puede asignar SUS equipos (y
  // conservar los que el pipeline ya tenía): antes podía crear un pipeline para
  // el equipo de otro y que le apareciera en su listado, o dejarse sin acceso.
  private assertTeamAccess(
    pl: CreatePipelineDTO,
    user: { userGroups?: string[] },
    existingTeams: string[] = [],
  ) {
    const userGroups = user.userGroups ?? [];
    if (userGroups.includes('admin')) {
      return;
    }
    const teams = pl.access?.teams ?? [];
    if (!teams.length) {
      throw new BadRequestException([
        'access.teams must contain at least one team',
      ]);
    }
    const allowed = new Set([...userGroups, ...existingTeams]);
    const foreign = teams.filter((team) => !allowed.has(team));
    if (foreign.length > 0) {
      throw new ForbiddenException(
        `You can only assign your own teams (not allowed: ${foreign.join(', ')})`,
      );
    }
    if (!teams.some((team) => userGroups.includes(team))) {
      throw new BadRequestException([
        'access.teams must include at least one of your teams',
      ]);
    }
  }

  // git y registry son opcionales (solo se usan al construir desde código fuente);
  // el resto del código asume que existen, así que se completan con valores vacíos.
  private toPipeline(pl: CreatePipelineDTO): IPipeline {
    return {
      name: pl.pipelineName,
      domain: pl.domain,
      phases: pl.phases,
      buildpack: pl.buildpack,
      reviewapps: pl.reviewapps,
      dockerimage: pl.dockerimage,
      git: pl.git ?? { keys: {}, webhook: {}, provider: '' },
      registry: (pl.registry ?? {
        host: '',
        username: '',
        password: '',
      }) as any,
      deploymentstrategy: pl.deploymentstrategy,
      buildstrategy: pl.buildstrategy,
      access: pl.access,
    };
  }
}
