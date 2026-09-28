import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: any, @Body() createProjectDto: CreateProjectDto) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.create(userId, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of projects for logged in user' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project detail by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only project admin can perform this action' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.update(id, userId, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project (Admin Only)' })
  @ApiResponse({ status: 204, description: 'Project deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only project admin can perform this action' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.remove(id, userId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add project member (Admin Only)' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 400, description: 'User is already a member of this project' })
  @ApiResponse({ status: 403, description: 'Only project admin can perform this action' })
  @ApiResponse({ status: 404, description: 'User not found / Project not found' })
  addMember(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Req() req: any,
    @Body() dto: AddMemberDto,
  ) {
    const adminUserId = req.user.id || req.user.sub;
    return this.projectsService.addMember(projectId, adminUserId, dto);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Update member role (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 403, description: 'Only project admin can perform this action' })
  @ApiResponse({ status: 404, description: 'Member not found in this project' })
  updateMemberRole(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Req() req: any,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const adminUserId = req.user.id || req.user.sub;
    return this.projectsService.updateMemberRole(projectId, adminUserId, targetUserId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from project (Admin Only)' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot remove yourself as the last admin of the project' })
  @ApiResponse({ status: 403, description: 'Only project admin can perform this action' })
  @ApiResponse({ status: 404, description: 'Member not found in this project' })
  removeMember(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Req() req: any,
  ) {
    const adminUserId = req.user.id || req.user.sub;
    return this.projectsService.removeMember(projectId, adminUserId, targetUserId);
  }
}