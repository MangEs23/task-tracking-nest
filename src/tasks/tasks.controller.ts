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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { ProjectMemberGuard } from '../projects/guards/project-member.guard';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('epics/:epicId/tasks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat task baru di dalam Epic' })
  @ApiResponse({ status: 201, description: 'Task berhasil dibuat' })
  @ApiResponse({
    status: 400,
    description: 'Status ID invalid / Status default belum diatur',
  })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Epic tidak ditemukan' })
  create(
    @Param('epicId', ParseUUIDPipe) epicId: string,
    @Req() req: any,
    @Body() dto: CreateTaskDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.tasksService.create(epicId, userId, dto);
  }

  @Get('epics/:epicId/tasks')
  @ApiOperation({ summary: 'Ambil semua task dalam Epic spesifik' })
  @ApiResponse({ status: 200, description: 'Berhasil mengambil daftar task' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Epic tidak ditemukan' })
  findAllByEpic(
    @Param('epicId', ParseUUIDPipe) epicId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.tasksService.findAllByEpic(epicId, userId);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Ambil detail task tunggal' })
  @ApiResponse({ status: 200, description: 'Berhasil mengambil detail task' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.tasksService.findOne(id, userId);
  }

  @Patch('tasks/:id')
  @ApiOperation({
    summary: 'Update task (title, description, priority, due_date, status_id)',
  })
  @ApiResponse({ status: 200, description: 'Task berhasil diperbarui' })
  @ApiResponse({
    status: 400,
    description: 'Status ID tidak terdaftar di proyek ini',
  })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateTaskDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.tasksService.update(id, userId, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus task' })
  @ApiResponse({ status: 204, description: 'Task berhasil dihapus' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.tasksService.remove(id, userId);
  }

  @Post('tasks/:id/assignees')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign user (member proyek) ke task' })
  @ApiResponse({ status: 201, description: 'User berhasil di-assign' })
  @ApiResponse({
    status: 400,
    description: 'User bukan member proyek / User sudah di-assign',
  })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  assignUser(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() req: any,
    @Body() dto: AssignUserDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.tasksService.assignUser(taskId, userId, dto);
  }

  @Delete('tasks/:id/assignees/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unassign user dari task' })
  @ApiResponse({ status: 204, description: 'User berhasil di-unassign' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Task / Assignee tidak ditemukan' })
  unassignUser(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Req() req: any,
  ) {
    const callerUserId = req.user.id || req.user.sub;
    return this.tasksService.unassignUser(taskId, callerUserId, targetUserId);
  }

  @Get('projects/:projectId/tasks')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({
    summary: 'List task lintas-epic dengan filter (Board/List View)',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Invalid filter / UUID' })
  @ApiResponse({ status: 403, description: 'Not a member of this project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findAllByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: any,
    @Query() filters: FilterTaskDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.tasksService.findAllByProject(projectId, userId, filters);
  }
}
