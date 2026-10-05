import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReorderStatusDto } from './dto/reorder-status.dto';

@Injectable()
export class StatusesService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper getters delegate model dengan fallback aman
  private get statusModel() {
    const model =
      (this.prisma as any).r_status ||
      (this.prisma as any).m_status ||
      (this.prisma as any).status;
    if (!model) {
      throw new InternalServerErrorException('Model Status (r_status) tidak ditemukan pada Prisma Service');
    }
    return model;
  }

  private get taskModel() {
    const model =
      (this.prisma as any).t_task ||
      (this.prisma as any).task;
    if (!model) {
      throw new InternalServerErrorException('Model Task (t_task) tidak ditemukan pada Prisma Service');
    }
    return model;
  }

  /**
   * Helper internal: Memastikan user adalah member proyek
   */
  private async verifyProjectMember(projectId: string, userId: string) {
    const member = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: userId,
      },
    });

    if (!member) {
      throw new ForbiddenException('Anda bukan anggota dari proyek ini');
    }

    return member;
  }

  /**
   * Helper internal: Ambil status dan verifikasi keanggotaan proyek
   */
  private async getStatusAndVerifyMember(statusId: string, userId: string) {
    const status = await this.statusModel.findUnique({
      where: { id: statusId },
    });

    if (!status) {
      throw new NotFoundException('Status tidak ditemukan');
    }

    await this.verifyProjectMember(status.project_id, userId);

    return status;
  }

  /**
   * POST /projects/:projectId/statuses
   * Membuat status baru dalam proyek
   */
  async create(projectId: string, userId: string, dto: CreateStatusDto) {
    await this.verifyProjectMember(projectId, userId);

    // Hitung order otomatis jika tidak dikirim
    const maxOrderStatus = await this.statusModel.findFirst({
      where: { project_id: projectId },
      orderBy: { order: 'desc' },
    });
    const orderValue = maxOrderStatus ? maxOrderStatus.order + 1 : 1;

    // Jika ini status pertama di proyek, paksa menjadi default
    const existingCount = await this.statusModel.count({
      where: { project_id: projectId },
    });
    const isDefault = existingCount === 0 ? true : false;

    return await this.statusModel.create({
      data: {
        project_id: projectId,
        name: dto.name,
        order: orderValue,
        is_default: isDefault,
      },
    });
  }

  /**
   * GET /projects/:projectId/statuses
   * Menampilkan semua status dalam proyek terurut berdasarkan 'order'
   */
  async findAllByProject(projectId: string, userId: string) {
    await this.verifyProjectMember(projectId, userId);

    return await this.statusModel.findMany({
      where: { project_id: projectId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * PATCH /statuses/:id
   * Memperbarui data status
   */
  async update(id: string, userId: string, dto: UpdateStatusDto) {
    const status = await this.getStatusAndVerifyMember(id, userId);

    // Jika mengubah is_default menjadi true, unset default status lain di proyek yang sama
    if (dto.is_default === true) {
      await this.statusModel.updateMany({
        where: {
          project_id: status.project_id,
          is_default: true,
          NOT: { id: id },
        },
        data: { is_default: false },
      });
    } else if (dto.is_default === false && status.is_default) {
      // Mencegah menghapus is_default jika tidak ada status default lain
      const otherDefault = await this.statusModel.findFirst({
        where: {
          project_id: status.project_id,
          is_default: true,
          NOT: { id: id },
        },
      });
      if (!otherDefault) {
        throw new BadRequestException('Proyek harus memiliki minimal 1 status default. Atur status lain sebagai default terlebih dahulu.');
      }
    }

    return await this.statusModel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
        ...(dto.is_done !== undefined && { is_done: dto.is_done }),
      },
    });
  }

  /**
   * DELETE /statuses/:id
   * Menghapus status dengan proteksi
   */
  async remove(id: string, userId: string) {
    const status = await this.getStatusAndVerifyMember(id, userId);

    // 1. Proteksi Minimal 1 Status per Proyek
    const totalStatuses = await this.statusModel.count({
      where: { project_id: status.project_id },
    });

    if (totalStatuses <= 1) {
      throw new BadRequestException('Tidak dapat menghapus status terakhir dari proyek');
    }

    // 2. Proteksi Task Terhubung
    const linkedTaskCount = await this.taskModel.count({
      where: { status_id: id },
    });

    if (linkedTaskCount > 0) {
      throw new BadRequestException(
        `Status tidak dapat dihapus karena masih digunakan oleh ${linkedTaskCount} task. Pindahkan task ke status lain terlebih dahulu.`,
      );
    }

    // 3. Jika status default yang dihapus, alihkan status default ke status pertama sisanya
    if (status.is_default) {
      const nextStatus = await this.statusModel.findFirst({
        where: {
          project_id: status.project_id,
          NOT: { id: id },
        },
        orderBy: { order: 'asc' },
      });

      if (nextStatus) {
        await this.statusModel.update({
          where: { id: nextStatus.id },
          data: { is_default: true },
        });
      }
    }

    await this.statusModel.delete({
      where: { id },
    });

    return null;
  }

  /**
   * PATCH /projects/:projectId/statuses/reorder
   * Mengubah urutan (order) banyak status sekaligus
   */
  async reorder(projectId: string, userId: string, dto: ReorderStatusDto) {
    await this.verifyProjectMember(projectId, userId);

    // Validasi bahwa semua status ID yang dikirim memang milik proyek ini
    const statusIds = dto.statuses.map((item) => item.id);
    const existingStatuses = await this.statusModel.findMany({
      where: {
        id: { in: statusIds },
        project_id: projectId,
      },
    });

    if (existingStatuses.length !== statusIds.length) {
      throw new BadRequestException('Satu atau lebih status_id tidak ditemukan atau tidak milik proyek ini');
    }

    // Update order satu per satu dalam promise
    const updatePromises = dto.statuses.map((item) =>
      this.statusModel.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    );

    await Promise.all(updatePromises);

    return await this.findAllByProject(projectId, userId);
  }
}