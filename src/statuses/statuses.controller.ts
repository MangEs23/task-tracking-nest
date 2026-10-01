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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatusesService } from './statuses.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReorderStatusDto } from './dto/reorder-status.dto';

@ApiTags('Statuses')
@ApiBearerAuth()
@Controller()
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Post('projects/:projectId/statuses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat status kustom baru untuk proyek' })
  @ApiResponse({ status: 201, description: 'Status berhasil dibuat' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: any,
    @Body() dto: CreateStatusDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.statusesService.create(projectId, userId, dto);
  }

  @Get('projects/:projectId/statuses')
  @ApiOperation({ summary: 'Ambil daftar status proyek terurut berdasarkan order' })
  @ApiResponse({ status: 200, description: 'Berhasil mengambil daftar status' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  findAllByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.statusesService.findAllByProject(projectId, userId);
  }

  @Patch('statuses/:id')
  @ApiOperation({ summary: 'Perbarui data status (nama, order, is_default, is_done)' })
  @ApiResponse({ status: 200, description: 'Status berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Validasi default status gagal' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Status tidak ditemukan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateStatusDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.statusesService.update(id, userId, dto);
  }

  @Delete('statuses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus status (dengan proteksi)' })
  @ApiResponse({ status: 204, description: 'Status berhasil dihapus' })
  @ApiResponse({ status: 400, description: 'Status terakhir atau masih digunakan oleh task' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  @ApiResponse({ status: 404, description: 'Status tidak ditemukan' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.statusesService.remove(id, userId);
  }

  @Patch('projects/:projectId/statuses/reorder')
  @ApiOperation({ summary: 'Ubah urutan tampilan banyak status sekaligus (reorder)' })
  @ApiResponse({ status: 200, description: 'Urutan status berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Satu atau lebih status_id invalid' })
  @ApiResponse({ status: 403, description: 'Anda bukan anggota proyek ini' })
  reorder(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: any,
    @Body() dto: ReorderStatusDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.statusesService.reorder(projectId, userId, dto);
  }
}