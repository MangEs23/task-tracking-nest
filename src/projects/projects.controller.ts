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
  @ApiOperation({ summary: 'Membuat project baru dan otomatis mendaftarkan pembuat sebagai admin' })
  @ApiResponse({ status: 201, description: 'Project berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: any, @Body() createProjectDto: CreateProjectDto) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.create(userId, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Mengambil daftar project milik user yang sedang login' })
  @ApiResponse({ status: 200, description: 'Berhasil mengambil daftar project' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mengambil detail project berdasarkan ID' })
  @ApiResponse({ status: 200, description: 'Berhasil mengambil detail project' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project tidak ditemukan atau Anda tidak memiliki akses' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project (Hanya Admin Proyek)' })
  @ApiResponse({ status: 200, description: 'Project berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Hanya admin proyek yang dapat mengubah proyek ini' })
  @ApiResponse({ status: 404, description: 'Project tidak ditemukan' })
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.update(id, userId, updateProjectDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus project (Hanya Admin Proyek)' })
  @ApiResponse({ status: 200, description: 'Project berhasil dihapus' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Hanya admin proyek yang dapat menghapus proyek ini' })
  @ApiResponse({ status: 404, description: 'Project tidak ditemukan' })
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.projectsService.remove(id, userId);
  }


  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tambah/Undang member baru ke project via email (Hanya Admin Proyek)' })
  @ApiResponse({ status: 201, description: 'Member berhasil ditambahkan' })
  @ApiResponse({ status: 400, description: 'Format email/payload tidak valid' })
  @ApiResponse({ status: 403, description: 'Hanya admin proyek yang dapat menambahkan member' })
  @ApiResponse({ status: 404, description: 'Project atau User email tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'User sudah menjadi member di proyek ini' })
  addMember(
    @Param('id') projectId: string,
    @Req() req: any,
    @Body() dto: AddMemberDto,
  ) {
    const adminUserId = req.user.id || req.user.sub;
    return this.projectsService.addMember(projectId, adminUserId, dto);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Ubah role member proyek (Hanya Admin Proyek)' })
  @ApiResponse({ status: 200, description: 'Role member berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Tidak bisa mengubah role admin terakhir' })
  @ApiResponse({ status: 403, description: 'Hanya admin proyek yang dapat mengubah role member' })
  @ApiResponse({ status: 404, description: 'Member tidak ditemukan di proyek ini' })
  updateMemberRole(
    @Param('id') projectId: string,
    @Param('userId') targetUserId: string,
    @Req() req: any,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const adminUserId = req.user.id || req.user.sub;
    return this.projectsService.updateMemberRole(projectId, adminUserId, targetUserId, dto);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Keluarkan/Hapus member dari proyek (Hanya Admin Proyek)' })
  @ApiResponse({ status: 200, description: 'Member berhasil dikeluarkan' })
  @ApiResponse({ status: 400, description: 'Admin terakhir tidak dapat dikeluarkan dari proyek' })
  @ApiResponse({ status: 403, description: 'Hanya admin proyek yang dapat mengeluarkan member' })
  @ApiResponse({ status: 404, description: 'Member tidak ditemukan di proyek ini' })
  removeMember(
    @Param('id') projectId: string,
    @Param('userId') targetUserId: string,
    @Req() req: any,
  ) {
    const adminUserId = req.user.id || req.user.sub;
    return this.projectsService.removeMember(projectId, adminUserId, targetUserId);
  }
}