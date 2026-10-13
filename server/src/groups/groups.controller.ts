import {
  Body,
  Controller,
  Delete,
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
import { GroupsService } from './groups.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ReadonlyGuard } from '../common/guards/readonly.guard';
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto';

@Controller({ path: 'api/groups', version: '1' })
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

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
    description: 'A List of Groups',
    type: OKDTO,
    isArray: true,
  })
  @ApiOperation({ summary: 'Get all Groups' })
  async getGroups(@Request() req: any) {
    return this.groupsService.findAll(
      req.user.userGroups,
      req.user.scopeToOwnTeam,
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
    description: 'Group created successfully',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Create a new Group' })
  async createGroup(@Body() groupData: CreateGroupDto, @Request() req: any) {
    return this.groupsService.create(
      groupData.name,
      groupData.description,
      req.user.userId,
      req.user.scopeToOwnTeam,
    );
  }

  @Delete('/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ReadonlyGuard)
  @Permissions('user:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'Group deleted successfully',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Delete a Group by ID' })
  async deleteGroup(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new Error('Group ID is required');
    }
    return this.groupsService.delete(
      id,
      req.user.userGroups,
      req.user.scopeToOwnTeam,
    );
  }

  @Put('/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, ReadonlyGuard)
  @Permissions('user:write')
  @ApiBearerAuth('bearerAuth')
  @ApiForbiddenResponse({
    description: 'Error: Unauthorized',
    type: OKDTO,
    isArray: false,
  })
  @ApiOkResponse({
    description: 'Group updated successfully',
    type: OKDTO,
    isArray: false,
  })
  @ApiOperation({ summary: 'Update a Group by ID' })
  async updateGroup(
    @Param('id') id: string,
    @Body() groupData: UpdateGroupDto,
    @Request() req: any,
  ) {
    return this.groupsService.update(
      id,
      groupData,
      req.user.userGroups,
      req.user.scopeToOwnTeam,
    );
  }
}
