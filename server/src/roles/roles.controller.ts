import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/strategies/jwt.guard';
import { OKDTO } from '../common/dto/ok.dto';
import { RolesService } from './roles.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ReadonlyGuard } from '../common/guards/readonly.guard';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Controller({ path: 'api/roles', version: '1' })
export class RolesController {
  constructor(private rolesService: RolesService) {}

  // Los roles no pertenecen a ningún equipo (a diferencia de usuarios y
  // equipos), así que acotarlos no tiene sentido: un rol acotado a equipo
  // propio puede ver los roles (para saber cuál asignar), pero no crear,
  // editar ni borrar ninguno.
  private assertNotScoped(req: any) {
    if (req.user.scopeToOwnTeam) {
      throw new ForbiddenException(
        'Tu rol no puede administrar roles del sistema',
      );
    }
  }

  @Get('/')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:read', 'user:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'A List of Roles',
    type: OKDTO,
    isArray: true,
  })
  @ApiOperation({ summary: 'Get all Roles' })
  async getRoles(@Request() req: any) {
    return this.rolesService.findAll(
      req.user.scopeToOwnTeam,
      req.user.priority,
    );
  }

  @Post('/')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ReadonlyGuard)
  @Permissions('user:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'Role created successfully',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Create a new Role' })
  async createRole(@Body() role: CreateRoleDto, @Request() req: any) {
    this.assertNotScoped(req);
    return this.rolesService.createRole(role);
  }

  @Delete('/:roleId')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ReadonlyGuard)
  @Permissions('user:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'Role deleted successfully',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Delete a Role' })
  async deleteRole(@Param('roleId') roleId: string, @Request() req: any) {
    this.assertNotScoped(req);
    return this.rolesService.deleteRole(roleId);
  }

  @Put('/:roleId')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ReadonlyGuard)
  @Permissions('user:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'Role updated successfully',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Update a Role' })
  async updateRole(
    @Param('roleId') roleId: string,
    @Body() role: UpdateRoleDto,
    @Request() req: any,
  ) {
    this.assertNotScoped(req);
    return this.rolesService.updateRole(roleId, role);
  }
}
