import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectAdminGuard } from '../projects/guards/project-admin.guard';
import { ProjectMemberGuard } from '../projects/guards/project-member.guard';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';
import { EpicAdminGuard } from './guards/epic-admin.guard';
import { EpicMemberGuard } from './guards/epic-member.guard';
import { EpicsService } from './epics.service';

@ApiTags('Epics')
@ApiBearerAuth()
@Controller()
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  @Post('projects/:projectId/epics')
  @UseGuards(ProjectAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create epic in a project (Admin Only)' })
  @ApiResponse({ status: 201, description: 'Epic created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed / end_date < start_date',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a project admin (or project not found)',
  })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateEpicDto,
  ) {
    return this.epicsService.create(projectId, dto);
  }

  @Get('projects/:projectId/epics')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({ summary: 'List epics of a project with progress' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a project member (or project not found)',
  })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.epicsService.findAllByProject(projectId);
  }

  @Get('epics/:id')
  @UseGuards(EpicMemberGuard)
  @ApiOperation({ summary: 'Get epic detail with progress and tasks' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a project member' })
  @ApiResponse({ status: 404, description: 'Epic not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.epicsService.findOne(id);
  }

  @Patch('epics/:id')
  @UseGuards(EpicAdminGuard)
  @ApiOperation({ summary: 'Update epic (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Epic updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed / empty body / end_date < start_date',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only project admin can perform this action',
  })
  @ApiResponse({ status: 404, description: 'Epic not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEpicDto) {
    return this.epicsService.update(id, dto);
  }

  @Delete('epics/:id')
  @UseGuards(EpicAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete epic (Admin Only, must have no tasks)' })
  @ApiResponse({ status: 204, description: 'Epic deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only project admin can perform this action',
  })
  @ApiResponse({ status: 404, description: 'Epic not found' })
  @ApiResponse({ status: 409, description: 'Epic still has tasks' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.epicsService.remove(id);
  }
}
